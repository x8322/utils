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


function crawl_voa_list(e, done) {
    e = e || {};
    var page = e.page || 1;
    var save = e.save === false ? false : true;
    logger.info('[VOA.list] start, page = ', page);
    async.waterfall([
        //get categories
        function(done) {
            LessonCategory.find({
                $and: [{
                    tags: 'voa'
                }, {
                    isLeaf: true
                }]
            }).exec(function(err, categories) {
                if (!err)
                    done(null, categories);
                categories = null;
            });
        },

        //crawl list
        function(categories, done) {
            async.eachSeries(categories, function(category, done) {
                var count = 0;
                var c = new Crawler({
                    maxConnections: 10,
                    callback: function(error, result, $) {
                        var boxes = $('#sc2 div.archive_rowmm');
                        var length = $(boxes).length;
                        console.log('[', category.name, '] [/', page, ']' + ' ================ >>> items : ' + length);
                        if (!length)
                            done();
                        $(boxes).each(function(index, box) {
                            var lastItem = index === length - 1;
                            count++;
                            var a = $(box).find('a').first();
                            var url = $(a).attr('href');
                            if (url && url.indexOf('http:') === -1) {
                                url = 'http://learningenglish.voanews.com' + url;
                                url = url.toLowerCase();
                                var name = $(a).find('.underlineLink').text() || $(a).text();
                                var description = $(box).find('p').first().text();
                                var image = $(box).find('img').first().attr('src');
                                Lesson.find({
                                    url: url
                                }).exec(function(err, lessons) {
                                    var lesson = lessons && lessons.length > 0 ? lessons[0] : null;
                                    if (!lesson) {
                                        console.info('add new lesson', {
                                            url: url,
                                            name: name,
                                            description: description
                                        });
                                        if (save) {
                                            lesson = new Lesson({
                                                url: url,
                                                name: name,
                                                description: description,
                                                image: image
                                            });
                                            lesson.categories.push(category._id);
                                            lesson.tags.push('voa');
                                            lesson.save(function(err) {
                                                if (lastItem)
                                                    done();
                                            });
                                        } else {
                                            if (lastItem)
                                                done();
                                        }
                                    } else {
                                        if (!lesson.image && image) {
                                            lesson = _.extend(lesson, {
                                                image: image
                                            });
                                            lesson.save();
                                            console.log('******* update missing image *******');
                                        } else {
                                            console.log('******* existed *******');
                                        }
                                        if (lastItem)
                                            done();
                                    }
                                });
                            }
                        });
                    }
                });
                var url = page ? category.url.replace('latest', page) : category.url;
                c.queue(url);
            }, function(err) {
                done();
            });
        }
    ], function(err, result) {
        console.log('[VOA.list] finish, page = ', page);
        if (_.isFunction(done))
            done();
    });
}


module.exports = function(agenda) {
    agenda.define('crawl_voa_list', function(job, done) {
        crawl_voa_list(job.attrs.data, done);
    });
};