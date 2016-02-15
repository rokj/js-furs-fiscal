FURSBusinessPremiseAPI = function(g) {
    var p = this;
    p.g = g;

    p.prepare_software_supplier_json = function(software_supplier_tax_number, foreign_software_supplier_name) {
        if (software_supplier_tax_number) {
            return {'TaxNumber': software_supplier_tax_number};
        } else {
            return {'NameForeign': foreign_software_supplier_name};
        }
    };

    p.prepare_business_premise_request_header = function() {
        var now = new Date();
        now = now.getFullYear() + "-" + (now.getMonth()+1) + "-" + now.getDate() + "T" + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + "Z";

        var header = {
            "MessageID": guid(),
            "DateTime": now
        };

        return header;
    };

    p.build_common_message_body = function (args) {
        var data = {};

        data['BusinessPremiseRequest'] = {};
        data['BusinessPremiseRequest'] = {
            'Header': p.prepare_business_premise_request_header(),
            'BusinessPremise': {
                'TaxNumber': args["tax_number"],
                'BusinessPremiseID': args["premise_id"],
                'ValidityDate': args["validity_date"], // .strftime("%Y-%m-%d"),
                'SpecialNotes': args["special_notes"],
                'SoftwareSupplier': [
                    p.prepare_software_supplier_json(args["software_supplier_tax_number"], args["foreign_software_supplier_name"])
                ],
                'BPIdentifier': {}
            }
        };

        return data;
    };

    p.register_immovable_business_premise = function(args) {
        /*
            tax_number, premise_id, real_estate_cadastral_number,
            real_estate_building_number,
            real_estate_building_section_number, street,
            house_number, house_number_additional, community, city,
            postal_code, validity_date, software_supplier_tax_number,
            foreign_software_supplier_name, special_notes
        */

        var message = p.build_common_message_body(args);

        var bpi_identifier = message['BusinessPremiseRequest']['BusinessPremise']['BPIdentifier'];

        bpi_identifier['RealEstateBP'] = {
            'Address': {
                'Street': args["street"],
                'HouseNumber': args["house_number"],
                'HouseNumberAdditional': args["house_number_additional"],
                'Community': args["community"],
                'City': args["city"],
                'PostalCode': args["postal_code"]
            },
            'PropertyID': {
                'CadastralNumber': args["real_estate_cadastral_number"],
                'BuildingNumber': args["real_estate_building_number"],
                'BuildingSectionNumber': args["real_estate_building_section_number"]
            }
        };

        if (!args["house_number_additional"] || args["house_number_additional"] == '') {
            delete message['BusinessPremiseRequest']['BusinessPremise']['BPIdentifier']['RealEstateBP']['Address']['HouseNumberAdditional'];
        }

        var url = p.g.FURS_TEST_ENDPOINT + '/' + p.g.REGISTER_BUSINESS_UNIT_PATH;

        var data = {
            'token': jwt_sign(get_jws_header(g.serial, g.subject_name, g.issuer_name, g.cert_password), message, 'RS256')
        };

        send_data(url, data, null, function(response) {
            console.log("successfully registered premise");
            console.log(response);
        });
    }
};

FURSInvoiceAPI = function(g) {
    var p = this;
    p.g = g;

    // Calculate ZOI - Protective Mark of the Invoice Issuer.
    p.calculate_zoi = function(args) {
        // tax_number, issued_date, invoice_number, business_premise_id, electronic_device_id, invoice_amount
        var issued_date = args['issued_date'].getFullYear() + "-" + (args['issued_date'].getMonth()+1) + "-" + args['issued_date'].getDate() + " " + args['issued_date'].getHours() + ":" + args['issued_date'].getMinutes() + ":" + args['issued_date'].getSeconds();

        var content = "" + args['tax_number'] + issued_date + args['invoice_number'] + args['business_premise_id'] + args['electronic_device_id'] + args['invoice_amount'];

        var sig = new KJUR.crypto.Signature({"alg": "SHA256withRSA"});
        sig.init(key);
        sig.updateString(content);

        return sig.sign();
    };

    p.prepare_invoice_request_header = function() {
        var now = new Date();
        now = now.getFullYear() + "-" + (now.getMonth()+1) + "-" + now.getDate() + "T" + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();

        var header = {
            "MessageID": guid(),
            "DateTime": now
        };

        return header;
    };

    // Get Data Record for QR Code/Code 128/PDF417 that should be placed at the bottom of the Invoice.
    p.prepare_printable = function (tax_number, zoi, issued_date) {
        var zoi_base10 = parseInt(zoi, 16);

        if (zoi_base10.length < 39) {
            var how_much = 39-zoi_base10.length;

            for (var i=0; i < how_much; i++) {
                zoi_base10 = "0" + zoi_base10;
            }
        }

        var data = zoi_base10 + tax_number + issued_date;
        var control = 0;

        for (var i = 0; i < zoi_base10.length; i++) {
            control = control + parseInt(zoi_base10[i]);
        }

        control = control % 10;

        return data + control;
    };


    p.build_common_message_body = function(args) {
        var data = {};

        var issued_date = args['issued_date'].getFullYear() + "-" + (args['issued_date'].getMonth()+1) + "-" + args['issued_date'].getDate() + " " + args['issued_date'].getHours() + ":" + args['issued_date'].getMinutes() + ":" + args['issued_date'].getSeconds();

        data['InvoiceRequest'] = {
            'Header': p.prepare_invoice_request_header(),
            'Invoice': {
                'TaxNumber': args['tax_number'],
                'IssueDateTime': issued_date,
                'NumberingStructure': args['numbering_structure'],
                'InvoiceIdentifier': {
                    'BusinessPremiseID': args['business_premise_id'],
                    'ElectronicDeviceID': args['electronic_device_id'],
                    'InvoiceNumber': args['invoice_number']
                },
                'InvoiceAmount': args['invoice_amount'],
                'PaymentAmount': args['payment_amount'],
                'ProtectedID': args['zoi'],
                'TaxesPerSeller': []
            }
        };

        return data;
    };

    p.build_tax_specification = function(low_tax_rate_base, low_tax_rate_amount, high_tax_rate_base, high_tax_rate_amount) {
        var low_tax_spec = {
            'TaxRate': low_tax_rate,
            'TaxableAmount': low_tax_rate_base,
            'TaxAmount': low_tax_rate_amount
        };

        var high_tax_spec = {
            'TaxRate': high_tax_rate,
            'TaxableAmount': high_tax_rate_base,
            'TaxAmount': high_tax_rate_amount
        };

        var ret = [];

        if (low_tax_spec['TaxableAmount']) ret.push(low_tax_spec);
        if (high_tax_spec['TaxableAmount']) ret.push(high_tax_spec);

        return ret;
    };

    p.get_invoice_eor = function(args) {
        /*
         zoi,
         tax_number,
         issued_date,
         invoice_number,
         business_premise_id,
         electronic_device_id,
         invoice_amount,
         low_tax_rate_base,
         low_tax_rate_amount,
         high_tax_rate_base,
         high_tax_rate_amount,
         other_taxes_amount,
         exempt_vat_taxable_amount,
         reverse_vat_taxable_amount,
         non_taxable_amount,
         special_tax_rules_amount,
         payment_amount,
         customer_vat_number,
         returns_amount,
         operator_tax_number,
         foreign_operator,
         subsequent_submit,
         reference_invoice_number,
         reference_invoice_business_premise_id,
         reference_invoice_electronic_device_id,
         reference_invoice_issued_date,
         numbering_structure,
         special_notes
        */

        var message = p.build_common_message_body(args);

        var tax_spec = {};

        if (args["tax_rates"]) {
            tax_spec['VAT'] = args["tax_rates"];
        }

        if (args["non_taxable_amount"]) {
            tax_spec['NontaxableAmount'] = args["non_taxable_amount"];
        }

        if (args["reverse_vat_taxable_amount"]) {
            tax_spec['ReverseVATTaxableAmount'] = args["reverse_vat_taxable_amount"];
        }

        if (args["exempt_vat_taxable_amount"]) {
            tax_spec['ExemptVATTaxableAmount'] = args["exempt_vat_taxable_amount"];
        }

        if (args["other_taxes_amount"]) {
            tax_spec['OtherTaxesAmount'] = args["other_taxes_amount"];
        }

        message['InvoiceRequest']['Invoice']['TaxesPerSeller'].push(tax_spec);

        if (args["customer_vat_number"]) {
            message['InvoiceRequest']['Invoice']['CustomerVATNumber'] = args["customer_vat_number"];
        }

        if (args["returns_amount"]) {
            message['InvoiceRequest']['Invoice']['ReturnsAmount'] = args["returns_amount"];
        }

        if (args["operator_tax_number"]) {
            message['InvoiceRequest']['Invoice']['OperatorTaxNumber'] = args["operator_tax_number"];
        }

        if (args["foreign_operator"]) {
            message['InvoiceRequest']['Invoice']['ForeignOperator'] = true;
        }

        if (args["subsequent_submit"]) {
            message['InvoiceRequest']['Invoice']['SubsequentSubmit'] = true;
        }

        var reference_invoice = null;

        if (args["reference_invoice_number"]) {
            var reference_invoice_issued_date = args["reference_invoice_issued_date"].getFullYear() + "-" + (args["reference_invoice_issued_date"].getMonth()+1) + "-" + args["reference_invoice_issued_date"].getDate() + "T" + args["reference_invoice_issued_date"].getHours() + ":" + args["reference_invoice_issued_date"].getMinutes() + ":" + args["reference_invoice_issued_date"].getSeconds() + "Z";
            reference_invoice = [{
                'ReferenceInvoiceIdentifier': {
                    'BusinessPremiseID': args["reference_invoice_business_premise_id"],
                    'ElectronicDeviceID': args["reference_invoice_electronic_device_id"],
                    'InvoiceNumber': args["reference_invoice_number"]
                },
                'ReferenceInvoiceIssueDateTime': reference_invoice_issued_date
            }];
        }

        message['InvoiceRequest']['Invoice']['ReferenceInvoice'] = args["reference_invoice"];

        var url = g.FURS_TEST_ENDPOINT + '/' + g.INVOICE_ISSUE_PATH;

        var data = {
            'token': jwt_sign(get_jws_header(g.serial, g.subject_name, g.issuer_name, g.cert_password), message, 'RS256')
        };

        send_data(url, data, null, function(response) {
            console.log("invoice sent");
            console.log(response);
            console.log(jwt_decode(data['token']));
        });
    }
};
