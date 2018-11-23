'use strict';

var _ = require('lodash'),
    glob = require('glob'),
    chalk = require('chalk'),
    is = require('is_js'),
    crypto = require('crypto'),
    fs = require('fs');

function format(template, values) {
    return _.template(template, values);
}

//error
function e(message) {
    console.log(chalk.red.bold(message));
}

//info
function i(message) {
    console.log(chalk.blue.bold(message));
}

//success
function s(message) {
    console.log(chalk.green.bold(message));
}


function friendlyUrl(str) {
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');

    str = str.replace(/ +(?= )/g, ''); //replace multi spaces to single
    str = str.replace(/[^a-zA-Z0-9.]/g, '-'); //replace all special chars to '-'
    return str;
}

//log
module.exports.l = console.log;

//Get path of files matched with patterns
function getFiles(globPatterns, removeRoot) {
    var urlRegex = new RegExp('^(?:[a-z]+:)?\/\/', 'i');
    var output = [];
    if (_.isArray(globPatterns)) {
        globPatterns.forEach(function(globPattern) {
            output = _.union(output, getFiles(globPattern, removeRoot));
        });
    } else if (_.isString(globPatterns)) {
        if (urlRegex.test(globPatterns)) {
            output.push(globPatterns);
        } else {
            glob(globPatterns, {
                sync: true
            }, function(err, files) {
                if (removeRoot) {
                    files = files.map(function(file) {
                        return file.replace(removeRoot, '');
                    });
                }
                output = _.union(output, files);
            });
        }
    }
    return output;
}

function getGlobbedPaths(globPatterns, excludes) {
    var urlRegex = new RegExp('^(?:[a-z]+:)?\/\/', 'i');
    var output = [];
    if (_.isArray(globPatterns)) {
        globPatterns.forEach(function(globPattern) {
            output = _.union(output, getGlobbedPaths(globPattern, excludes));
        });
    } else if (_.isString(globPatterns)) {
        if (urlRegex.test(globPatterns)) {
            output.push(globPatterns);
        } else {
            glob(globPatterns, {
                sync: true
            }, function(err, files) {
                if (excludes) {
                    files = files.map(function(file) {
                        if (_.isArray(excludes)) {
                            for (var i in excludes) {
                                file = file.replace(excludes[i], '');
                            }
                        } else {
                            file = file.replace(excludes, '');
                        }

                        return file;
                    });
                }
                output = _.union(output, files);
            });
        }
    }
    return output;
}

function trimAll(value) {
    if (typeof value !== 'string')
        return '';
    return value.replace(/\s\s+/g, ' ').trim();
}

function isEndWith(url, values) {
    var result = false;
    if (url && is.url(url)) {
        url = url.toLowerCase().trim();
        if (url.indexOf('?') > -1)
            url = url.split('?')[0];
        _.each(values, function(value) {
            if (is.endWith(url, value)) {
                result = url;
                return result;
            }
        });
    }
    return result;
}

function isValidPdf(url) {
    return isEndWith(url, ['.pdf', '.html', '.htm']);
}

function isValidAudio(url) {
    return isEndWith(url, ['.mp3', '.wav']);
}

function getFilesInDir(dirPath) {
    // './modules/agenda/jobs/'
    return fs.readdirSync(dirPath);
}

function random(length, chars) {
    chars = chars || 'abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789';
    var rnd = crypto.randomBytes(length),
        value = new Array(length),
        len = chars.length;

    for (var i = 0; i < length; i++) {
        value[i] = chars[rnd[i] % len];
    }

    return value.join('');
}

module.exports = {
    //loging
    e: e,
    i: i,
    s: s,

    //string helper
    format: format,

    //file helper
    getFiles: getFiles,
    getGlobbedPaths: getGlobbedPaths,
    trimAll: trimAll,

    //validate
    isValidPdf: isValidPdf,
    isValidAudio: isValidAudio,
    isEndWith: isEndWith,

    random: random
};