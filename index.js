var walkdir = require('walkdir'),
    EventEmitter = require('events').EventEmitter,
    dateformat = require('dateformat'),
    paramCase = require('param-case'),
    shellEsc = require('shell-escape'),
    shellEscape = function(arg) { return shellEsc([arg]); },
    path = require('path'),
    spawn = require('child_process').spawn,
    split = require('split'),
    logFields = require(__dirname + '/log-fields');

module.exports = {
    getLogsForRepos: getLogsForRepos,
    findGitRepos: findGitRepos,
    getGitLogForRepo: getGitLog
};

function getLogsForRepos(dir, options, callback) {
    options = options || (options = { });
    options.emitter = options.emitter || new EventEmitter();

    findGitRepos(dir, options, function(err, repos) {
        var remaining = repos.length, repoCommits = {};
        repos.forEach(function(repoPath) {
            var key = path.dirname(path.relative(dir, repoPath));
            getGitLog(repoPath, options, function(err, commits) {
                if (commits && commits.length) {
                    repoCommits[key] = commits;
                }

                if (--remaining === 0) {
                    callback(null, repoCommits);
                }
            });
        });
    });

    return options.emitter;
}

function findGitRepos(dir, options, callback) {
    if (!callback && typeof options === 'function') {
        callback = options;
        options = null;
    }

    options = options || (options = { followSymlinks: true });
    options.emitter = options.emitter || new EventEmitter();

    var repos = [];
    var walker = walkdir(dir, {
        follow_symlinks: options.followSymlinks,
        no_recurse: options.noRecurse,
        max_depth: options.maxDepth
    });

    walker.on('directory', function(path) {
        if (!path.match(/(\.git|refs)$/)) {
            return;
        }

        options.emitter.emit('repo', path);
        repos.push(path);
    });

    walker.on('end', function() {
        options.emitter.emit('end');
        callback(null, repos);
    });
}

function getGitLog(repo, options, callback) {
    if (!callback && typeof options === 'function') {
        callback = options;
        options = null;
    }

    options = options || (options = {});
    options.emitter = options.emitter || new EventEmitter();

    var args = ['--no-pager', 'log'];

    // Dates
    ['since', 'after', 'until', 'before'].forEach(function(flag) {
        if (!options[flag]) { return; }
        args.push('--' + flag);
        args.push(gitDate(options[flag]));
    });

    // Numbers
    ['number', 'maxCount', 'skip', 'minParents', 'maxParents'].forEach(function(flag) {
        if (!options[flag]) { return; }
        args.push('--' + paramCase(flag) + '=' + shellEscape(options[flag]));
    });

    // Booleans - who knows if we'll need these or if they even work *shrugs*
    ['follow', 'source', 'regexpIgnoreCase', 'allMatch', 'extendedRegexp',
     'fixedStrings', 'perlRegexp', 'removeEmpty', 'merges', 'noMerges',
     'firstParent', 'all', 'ignoreMissing', 'leftOnly', 'rightOnly',
     'boundary'].forEach(function(flag) {
        if (!options[flag]) { return; }
        args.push('--' + paramCase(flag));
    });

    // Patterns
    ['author', 'committer', 'grep', 'branches', 'tags', 'remotes', 'glob'].forEach(function(flag) {
        if (!options[flag]) { return; }
        if (!Array.isArray(options[flag])) {
            options[flag] = [options[flag]];
        }

        options[flag].forEach(function(pattern) {
            args.push('--' + paramCase(flag) + '=' + shellEscape(pattern.toString()));
        });
    });

    // Then prettify the format
    var fields = options.fields || logFields.defaultFields;
    args.push('--pretty=' + logFields.getPrettyFormat(fields) + '');

    // Run the command
    var commits = [], repoPath = path.dirname(repo);
    var proc = spawn('git', args, { cwd: repoPath });

    proc.stderr.pipe(split()).on('data', function(err) {
        if (err) { options.emitter.emit('git-error', err); }
    });

    proc.stdout.pipe(split()).on('data', function(line) {
        if (!line || !line.length) {
            return;
        }

        var parsed = parseLogLine(repoPath, fields, line);

        commits.push(parsed);
        options.emitter.emit('commit', parsed);
    });

    proc.stdout.on('end', function() {
        options.emitter.emit('repo-end', repo);
        callback(null, commits);
    });
}

function gitDate(date) {
    if (typeof date === 'string') {
        return date;
    }

    return dateformat(date, 'ddd mmm d HH:MM:ss yyyy o');
}

function parseLogLine(repo, fields, line) {
    var parsed = { repo: repo };
    line.split(logFields.delimiter).forEach(function(value, i) {
        parsed[fields[i]] = value;
    });

    return parsed;
}