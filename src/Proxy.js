Ext.define('CouchDB.data.Proxy', {
    extend: 'Ext.data.proxy.Rest',
    alias : 'proxy.couchdb',

    constructor: function(config) {
        var databaseUrl = config.databaseUrl || '/';
        var databaseName = config.databaseName || 'your_database';
        var designName = config.designName || 'your_design_name';
        var viewName = config.viewName || 'your_view_name';

        this.restUrl = config.databaseUrl + '/' + databaseName;
        this.viewUrl = config.databaseUrl + '/' + databaseName + '/_design/' + designName + '/_view/' + viewName;

        Ext.apply(config, {
            url: databaseUrl,
            api: {
                create: this.restUrl,
                read: this.viewUrl,
                update: this.restUrl,
                destroy: this.restUrl
            },
            appendId: true,
            reader: {
                type: 'couchdb'
            },
            writer: {
                type: 'couchdb'
            }
        });

        this.callParent(arguments);
    },

    // This method is overridden to switch between loading a single object or executing a query using
    // a CouchDB view.
    read: function(operation, callback, scope) {
        var extraParams = {
            'include_docs': true
        }

        try {

            // CouchDB will include the entire document with the 'include_docs' parameter.
            if (operation.config.params._id){
                this.config.api.read = this.restUrl;
                this.setAppendId(true);
            } else {
                this.config.api.read = this.viewUrl;
                this.setAppendId(false);
            }

            Ext.apply(this.config.extraParams, extraParams);
            this.callParent(arguments);

        } finally {
            this.setAppendId(true);
            this.config.api.read = this.restUrl;
            
            //clear extraParams
            for (var prop in this.config.extraParams) {
                delete this.config.extraParams[prop];
            }
        }
    },

    // This method is overridden because Ext JS expects the PUT or POST request to return the object,
    // but CouchDB only returns the id and the new revision.
    update: function(operation, callback, scope) {
        var create = operation.config.action === 'create';
        var data;

        // Preserve the original data because Ext JS will copy blank values into it since the
        // response doesn't contain the result object.
        if (create) {
            data = Ext.apply({}, operation._records[0].data);
        }

        var callbackWrapper = function(op) {
            // This prevents Ext JS from seeing result records and trying to operate on them.
            op.resultSet = undefined;
            // Errors will not have a response object.
            if (op._response) {
                // For create, restore the preserved data and set the ID returned from CouchDB.
                if (create) {
                    Ext.apply(op._records[0].data, data);
                    op._records[0].data._id = Ext.JSON.decode(op._response.responseText).id;
                }

                // The new rev must be applied to the object that was updated.
                op._records[0].data._rev = Ext.JSON.decode(op._response.responseText).rev;
            }
            callback(op);
        };
        return this.doRequest(operation, callbackWrapper, scope);
    },

    create: function(operation, callback, scope) {
        return this.update(operation, callback, scope);
    },

    // This method is overridden to support CouchDB's requirement to specify a revision of the object
    // to delete.
    destroy: function(operation, callback, scope) {
        try {
            // CouchDB expects a specific revision to be defined as the 'rev' parameter.
            Ext.apply(this.config.extraParams, { 'rev': operation.getRecords()[0].get('_rev') });
            this.callParent(arguments);
        } finally {
            //clear extraParams
            for (var prop in this.config.extraParams) {
                delete this.config.extraParams[prop];
            }
        }
    }
});