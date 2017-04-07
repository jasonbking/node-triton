/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2017 Joyent, Inc.
 *
 * `triton image export ...`
 */

var assert = require('assert-plus');
var format = require('util').format;
var fs = require('fs');
var strsplit = require('strsplit');
var tabula = require('tabula');
var vasync = require('vasync');

var common = require('../common');
var errors = require('../errors');

// ---- the command

function do_export(subcmd, opts, args, cb) {
    if (opts.help) {
        this.do_help('help', {}, [subcmd], cb);
        return;
    } else if (args.length !== 2) {
        cb(new errors.UsageError(
            'incorrect number of args: expect 2, got ' + args.length));
        return;
    }

    var log = this.top.log;
    var tritonapi = this.top.tritonapi;

    vasync.pipeline({arg: {cli: this.top}, funcs: [
        common.cliSetupTritonApi,
        function getImage(ctx, next) {
            tritonapi.getImage(args[0], function getRes(err, img) {
                if (err) {
                    next(err);
                    return;
                }

                log.trace({image: img}, 'image export: img');
                ctx.img = img;
                next();
            });
        },
        function exportImage(ctx, next) {
            log.trace({ dryRun: opts.dry_run, manta_path: ctx.manta_path},
                'image export path');

            console.log('Exporting image %s@%s to %s',
                ctx.img.name, ctx.img.version, args[1]);

            if (!opts.dry_run) {
                tritonapi.cloudapi.exportImage({
                    id: ctx.img.id,
                    manta_path: args[1]
                }, function (err, path) {
                    if (err) {
                        next(new errors.TritonError(err,
                            'error exporting image to manta'));
                        return;
                    }

                    log.trace({path: path}, 'image export: path');
                    ctx.path = path;
                    next();
                    return;
                });
            }
        },
        function outputResults(ctx, next) {
            if (opts.json) {
                console.log(JSON.stringify(ctx.path));
            } else {
                console.log('Manta URL: %s', ctx.path.manta_url);
                console.log('Manifest path: %s', ctx.path.manifest_path);
                console.log('Image path: %s', ctx.path.image_path);
            }
            next();
            return;
        }
    ]}, function (err) {
        cb(err);
    });
}

do_export.options = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    },
    {
        group: 'Other options'
    },
    {
        names: ['dry-run'],
        type: 'bool',
        help: 'Go through the motions without actually creating.'
    },
    {
        names: ['json', 'j'],
        type: 'bool',
        help: 'JSON stream output.'
    }
];

do_export.synopses = [
    '{{name}} {{cmd}} [OPTIONS] IMAGE MANTA_PATH'
];

do_export.help = [
    /* BEGIN JSSTYLED */
    'Export an image.',
    '',
    '{{usage}}',
    '',
    '{{options}}',
    'Where "IMAGE" is an image id (a full UUID), an image name (selects the',
    'latest, by "published_at", image with that name), an image "name@version"',
    '(selects latest match by "published_at"), or an image short ID (ID prefix).'
    /* END JSSTYLED */
].join('\n');

do_export.completionArgtypes = ['tritonimage', 'none'];

module.exports = do_export;
