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

function crawl_bbc(e, done) {
    logger.info('[BBC] start');
    async.waterfall([
        //get categories
        function(done) {
            LessonCategory.find({
                $and: [{
                    tags: 'bbc'
                }, {
                    isLeaf: true
                }]
            }).exec(function(err, categories) {
                categories = []; //TODO: don't crawl new lessons
                if (!err)
                    done(null, categories);
            });
        },

        //crawl list
        function(categories, done) {
            console.info('[BBC.categories] start', {
                categories: categories.length
            });
            async.eachSeries(categories, function(category, done) {
                var c = new Crawler({
                    maxConnections: 10,
                    callback: function(error, result, $) {
                        var length = $('.widget h2 a').length;
                        $('.widget h2 a').each(function(index, a) {
                            var lastItem = index === length - 1;
                            var url = $(a).attr('href');
                            if (url && url.indexOf('http:') === -1) {
                                url = 'http://www.bbc.co.uk' + url;
                                url = url.toLowerCase();
                                var name = $(a).text();
                                var box = $(a).parent().parent();
                                var description = $(box).find('p').first().text();
                                var image = $(box).parent().find('.img img').first().attr('src');
                                var date = $(box).find('.widget-bbcle-coursecontentlist .text .details h3').first().text();
                                if (date && date.split('/').length > 0) {
                                    date = date.split('/')[1].trim() + ' GMT+0000';
                                    date = new Date(date).toISOString();
                                } else {
                                    date = null;
                                }
                                Lesson.find({
                                    url: url
                                }).exec(function(err, lessons) {
                                    if (lessons && lessons.length === 0) {
                                        console.info('add new lesson', {
                                            url: url,
                                            name: name
                                        });
                                        var lesson = new Lesson({
                                            url: url,
                                            name: name,
                                            description: description,
                                            published: date,
                                            image: image
                                        });
                                        lesson.tags.push('bbc');
                                        lesson.categories.push(category._id);
                                        lesson.save(function(err) {
                                            if (lastItem)
                                                done();
                                        });
                                    } else {
                                        console.log('******* existed ******* : ', url);
                                        if (lastItem)
                                            done();
                                    }
                                });
                            }
                        });
                    }
                });
                c.queue(category.url);
            }, function(err) {
                done();
            });
        },

        //get lessons
        function(done) {
            Lesson.find({
                tags: 'bbc',
                $or: [{
                    pdf: ''
                }, {
                    audio: ''
                }]
            }).exec(function(err, lessons) {
                if (!err)
                    done(null, lessons);
            });
        },

        //crawl detail
        function(lessons, done) {
            console.info('[BBC.details] start', {
                count: lessons.length
            });
            async.eachSeries(lessons, function(lesson, done) {
                var c = new Crawler({
                    maxConnections: 10,
                    callback: function(error, result, $) {
                        var pdf = $('.bbcle-download-extension-pdf').attr('href');
                        if (!pdf)
                            pdf = $('a[href*=".pdf"]').first().attr('href');
                        if (pdf)
                            pdf = pdf.toLowerCase();
                        if (!utils.isValidPdf(pdf))
                            pdf = '';

                        var audio = $('.bbcle-download-extension-mp3').attr('href');
                        if (!audio)
                            audio = $('a[href*=".mp3"]').first().attr('href');
                        if (!audio)
                            audio = $('a[href*=".wav"]').first().attr('href');
                        if (audio)
                            audio = audio.toLowerCase();
                        if (!utils.isValidAudio(audio))
                            audio = '';

                        if (audio)
                            lesson.audio = audio;
                        if (pdf)
                            lesson.pdf = pdf;
                        if (!pdf) {
                            var content = $('.widget-richtext').html();
                            if (content)
                                lesson.content = content;
                        }

                        lesson = _.extend(lesson, {
                            crawl_failed: (!pdf && !audio) ? true : false
                        });
                        console.info('update lesson', {
                            name: lesson.name
                        });
                        lesson.save(function(err) {
                            done();
                        });
                    }
                });
                c.queue(lesson.url);
            }, function() {
                done();
            });
        }
    ], function(err, result) {
        console.log('[BBC] finish');
        done();
    });
}

module.exports = function(agenda) {
    agenda.define('crawl_bbc', function(job, done) {
        crawl_bbc(job.attrs.data, done);
    });
};