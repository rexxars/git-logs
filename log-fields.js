var delimiter = '\t¤_¤\t';
var logFields = {
    hash: '%H',
    abbrevHash: '%h',
    treeHash: '%T',
    abbrevTreeHash: '%t',
    parentHashes: '%P',
    abbrevParentHashes: '%P',
    authorName: '%an',
    authorEmail: '%ae',
    authorDate: '%ai',
    authorDateRel: '%ar',
    committerName: '%cn',
    committerEmail: '%ce',
    committerDate: '%cd',
    committerDateRel: '%cr',
    subject: '%s',
};

function getPrettyFormat(fields) {
    var formats = [];
    fields.forEach(function(field) {
        if (!logFields[field]) { return; }
        formats.push(logFields[field]);
    });

    return formats.join(delimiter);
}

module.exports = {
    getPrettyFormat: getPrettyFormat,
    fields: logFields,
    delimiter: delimiter,
    defaultFields: [
        'abbrevHash',
        'hash',
        'subject',
        'authorName',
        'authorDate'
    ]
};