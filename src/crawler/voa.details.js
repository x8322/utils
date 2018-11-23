'use strict';

const utils = require('../lib/utils'),
    logger = require('../lib/log'),
    _ = require('lodash'),
    path = require('path'),
    mongoose = require('mongoose'),
    Lesson = mongoose.model('Lesson'),
    LessonCategory = mongoose.model('LessonCategory'),
    is = require('is_js'),
    async = require('async'),
    Crawler = require('crawler');


function crawl_voa_details(e, done) {
    var limit = e.limit || 10;
    var save = e.save === false ? false : true;

    logger.info('[VOA.details] start, limit = ', limit);
    async.waterfall([
        //get lessons
        function(done) {
            Lesson.find({
                    tags: 'voa',
                    crawl_failed: false
                })
                .or([{
                        pdf: {
                            $eq: ''
                        }
                    }, {
                        audio: {
                            $eq: ''
                        }
                    },
                    // {
                    //     content: {
                    //         $eq: ''
                    //     }
                    // }
                ])
                .limit(limit)
                .exec(function(err, lessons) {
                    if (!err)
                        done(null, lessons);
                });
        },

        //crawl detail
        function(lessons, done) {
            console.info('[VOA.details] start', {
                count: lessons.length
            });
            if (lessons.length === 0) {
                done();
                return;
            }
            async.eachSeries(lessons, function(lesson, done) {
                var c = new Crawler({
                    maxConnections: 10,
                    callback: function(error, result, $) {
                        var close_message = 'This forum has been closed.';
                        if ($('.instruction').html() === close_message) {
                            console.log('==============>>>> ', JSON.stringify({
                                url: lesson.url,
                                error: close_message
                            }));
                            lesson.crawl_failed = true;
                            lesson.save();
                            done();
                        }
                        var pdf = $('a.printico').first().attr('href');
                        if (!pdf)
                            pdf = $('.toplinks ul li a.printico').first().attr('href'); //older
                        if (pdf && !is.startWith(pdf, 'http'))
                            pdf = 'http://learningenglish.voanews.com' + pdf;
                        if (pdf)
                            pdf = pdf.toLowerCase();
                        if (!utils.isValidPdf(pdf))
                            pdf = '';

                        var audio = $('.downloadlink ul, .downloadvideoico ul, .playlistlink ul').find('a').first().attr('href');
                        if (!audio)
                            audio = $('div.contentWidget ul.bullet_orange li ul li a.listenico').first().attr('href'); //older
                        if (!audio)
                            audio = $('li.listenlink a.listenico').first().attr('href'); //older
                        if (!audio)
                            audio = $('a[href$=".mp3"]').first().attr('href'); //older
                        if (!audio) {
                            audio = $('param[name=flashvars]').attr('value');
                            if (audio)
                                audio = audio.substr(audio.indexOf('http'), audio.indexOf('&') - 5);
                        }
                        if (audio && !is.startWith(audio, 'http'))
                            audio = 'http://learningenglish.voanews.com' + audio;
                        if (audio)
                            audio = audio.toLowerCase();
                        if (!utils.isEndWith(audio, ['.mp3', '.wav', '.html']))
                            audio = '';
                        audio = audio.split('?')[0];

                        var image = $('div.contentImage img').first().attr('src');

                        var date = $('p.article_date').first().text();
                        if (date) {
                            date = date.trim() + ' GMT+0000';
                            date = new Date(date).toISOString();
                        } else {
                            date = null;
                        }

                        lesson = _.extend(lesson, {
                            pdf: pdf,
                            audio: audio,
                            published: date,
                            crawl_failed: (!pdf && !audio) ? true : false
                        });
                        if (!pdf) {
                            var content = $('#article div.zoomMe').html();
                            content = utils.trimAll(content);
                            lesson.content = content;
                        }

                        if (image && is.url(image))
                            lesson.image = image;
                        console.info('update lesson', {
                            name: lesson.name,
                            url: lesson.url,
                            pdf: pdf,
                            audio: audio,
                            image: lesson.image,
                            content: lesson.content,
                            published: date,
                        });
                        if (save) {
                            lesson.save(function(err) {
                                done();
                            });
                        } else {
                            done();
                        }
                    }
                });
                c.queue(lesson.url);
            }, function() {
                done();
            });
        }
    ], function(err, result) {
        console.log('[VOA.details] finish, limit = ', limit);
        if (_.isFunction(done))
            done();
    });
}


module.exports = function(agenda) {
    agenda.define('crawl_voa_details', function(job, done) {
        crawl_voa_details(job.attrs.data, done);
    });
};