function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function get_jws_header(serial, subject_name, issuer_name) {
    var jws_header = {
        'alg': 'RS256',
        'subject_name': '',
        'issuer_name': '',
        'serial': serial
    };

    for (var i = 0; i < subject_name.attributes.length; i++) {
        var attributes = subject_name.attributes[i];

        if ('shortName' in attributes) {
            jws_header['subject_name'] = jws_header['subject_name'] + "," + attributes['shortName'] + "=" + attributes['value'];
        } else {
            jws_header['subject_name'] = jws_header['subject_name'] + "," + attributes['name'] + "=" + attributes['value'];
        }
    }

    for (var i = 0; i < issuer_name.attributes.length; i++) {
        var attributes = issuer_name.attributes[i];

        if ('shortName' in attributes) {
            jws_header['issuer_name'] = jws_header['issuer_name'] + "," + attributes['shortName'] + "=" + attributes['value']
        } else {
            jws_header['issuer_name'] = jws_header['issuer_name'] + "," + attributes['name'] + "=" + attributes['value'];
        }
    }

    jws_header['subject_name'] = jws_header['subject_name'].substring(1);
    jws_header['issuer_name'] = jws_header['issuer_name'].substring(1);

    return jws_header;
}

/* kudos
 * https://github.com/digitalbazaar/forge/issues/298
 */
function loadPkcs12(pkcs12Der, password, caStore) {
    var pkcs12Asn1 = forge.asn1.fromDer(pkcs12Der);
    var pkcs12 = forge.pkcs12.pkcs12FromAsn1(pkcs12Asn1, false, password);

    // load keypair and cert chain from safe content(s) and map to key ID
    var map = {};

    for (var sci = 0; sci < pkcs12.safeContents.length; ++sci) {
        var safeContents = pkcs12.safeContents[sci];

        for (var sbi = 0; sbi < safeContents.safeBags.length; ++sbi) {
            var safeBag = safeContents.safeBags[sbi];
            var localKeyId = null;

            if (safeBag.attributes.localKeyId) {
                localKeyId = forge.util.bytesToHex(safeBag.attributes.localKeyId[0]);

                if (!(localKeyId in map)) {
                    map[localKeyId] = {
                        privateKey: null,
                        certChain: []
                    };
                }
            } else {
                // no local key ID, skip bag
                continue;
            }

            // this bag has a private key
            if(safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
                map[localKeyId].privateKey = safeBag.key;
            } else if(safeBag.type === forge.pki.oids.certBag) {
                // this bag has a certificate
                map[localKeyId].certChain.push(safeBag.cert);
            }
        }
    }

    for (var localKeyId in map) {
        var entry = map[localKeyId];

        if (entry.privateKey) {
            var privateKeyP12Pem = forge.pki.privateKeyToPem(entry.privateKey);
            // var encryptedPrivateKeyP12Pem = forge.pki.encryptRsaPrivateKey(entry.privateKey, password);
            key = privateKeyP12Pem;
        }
    }
}

function jwt_sign(header, payload, algorithm, password) {
    var header = JSON.stringify(header);
    var payload = JSON.stringify(payload);
    var private_key = KEYUTIL.getKey(key, password);

    var sJWT = KJUR.jws.JWS.sign(algorithm, header, payload, private_key);

    return sJWT;
}
