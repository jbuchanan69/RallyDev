// ERB Dashboard - Version 2.5
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

    items:[{
        xtype  : 'container',
        id     : 'toolbar',
        layout : 'hbox'
    },{
        xtype  : 'container',
        id     : 'viewport'
    }],

	launch: function() {
        App = this;
        App.teamNameHash.init(function() {
            App.toolbar.init();
        });
        App.down('#viewport').addListener('resize', function() {
            if (App.popup) {
                App.popup.setWidth(Ext.getBody().getWidth());
                App.popup.setHeight(Ext.getBody().getHeight());
            }
        });
	},

    teamNameHash: {
        init: function(callback) {
            Ext.create('Rally.data.WsapiDataStore', {
                model : 'Project',
                limit : Infinity,
                fetch : ['ObjectID','Name']
            }).load({
                callback: function(store) {
                    App.teamNameHash = {};
                    Ext.Array.each(store.getItems(), function(team) {
                        App.teamNameHash[team.ObjectID] = team.Name;
                    });
                    callback();
                }
            });
        }
    },

    toolbar: {
        init: function() {
            App.toolbar.yearPicker.add(function() {
                App.toolbar.weekPicker.add();
            });
        },
        yearPicker: {
            add: function(callback) {
                App.down('#toolbar').add({
                    xtype      : 'spinnerfield',
                    fieldLabel : 'Release Week:',
                    id         : 'releaseYear',
                    value      : new Date().getFullYear(),
                    width      : 135,
                    labelWidth : 72,
                    editable   : false,
                    onSpinUp: function() {
                        this.setValue(parseInt(this.getValue()) + 1);
                        App.toolbar.weekPicker.update();
                    },
                    onSpinDown: function() {
                        if (this.getValue() > 2013) {
                            this.setValue(parseInt(this.getValue()) - 1);
                            App.toolbar.weekPicker.update();
                        }
                    },
                    listeners: {
                        added: callback
                    }
                });
            }
        },
        weekPicker: {
            add: function() {
                App.toolbar.weekPicker.getWeekInfo(function(weekStore, currWeek) {
                    App.down('#toolbar').add({
                        xtype          : 'combo',
                        id             : 'releaseWeek',
                        width          : 155,
                        editable       : false,
                        forceSelection : true,
                        queryMode      : 'local',
                        displayField   : 'Name',
                        valueField     : 'DateRange',
                        value          : currWeek,
                        store: {
                            fields: ['Name','DateRange'],
                            data: weekStore
                        },
                        listeners   : {
                            change  : App.viewport.update,
                            added   : function() {
                                App.down('#toolbar').add({
                                    xtype   : 'button',
                                    cls     : 'weekChangeBtn',
                                    text    : '&#8249;',
                                    height  : 18,
                                    border  : 0,
                                    margins : '2 0 0 8',
                                    handler : function() {
                                        var picker = App.down('#releaseWeek');
                                        var index  = picker.findRecord(picker.valueField || picker.displayField, picker.getValue()).index;
                                        if (index > 0) picker.select(picker.getStore().getAt(index - 1).data.DateRange);
                                    }
                                });
                                App.down('#toolbar').add({
                                    xtype   : 'button',
                                    cls     : 'weekChangeBtn',
                                    text    : '&#8250;',
                                    height  : 18,
                                    border  : 0,
                                    margins : '2 0 0 5',
                                    handler : function() {
                                        var picker = App.down('#releaseWeek');
                                        var index  = picker.findRecord(picker.valueField || picker.displayField, picker.getValue()).index;
                                        if (index < picker.getStore().data.length - 1) picker.select(picker.getStore().getAt(index + 1).data.DateRange);
                                    }
                                });
                                App.viewport.update();
                            }
                        }
                    });
                });
            },

            update: function() {
                App.down('#releaseWeek').destroy();
                App.toolbar.weekPicker.add();
            },

            getWeekInfo: function(callback) {
                // Starting with the first Monday of the year, get all release weeks
                var currWeek,
                    weekNumber = 1,
                    weeks      = [],
                    aDate      = new Date(App.down('#releaseYear').getValue(), 0, 1); // First day of the year
                while (aDate.getDay() != 1) {
                    aDate.setDate(aDate.getDate() - 1);
                }
                do {
                    weeks.push({
                        Name      : 'Week ' + ((weekNumber < 10) ? '0' : '') + weekNumber + ': ' + Ext.Date.format(aDate, 'M j') + ' - ' + Ext.Date.format(Ext.Date.add(aDate, Ext.Date.DAY, 6), 'M j'),
                        DateRange : {
                            StartDate : Rally.util.DateTime.toIsoString(aDate),
                            EndDate   : Rally.util.DateTime.toIsoString(Ext.Date.add(aDate, Ext.Date.MILLI, 604799999))
                        }
                    });
                    if (Ext.Date.format(aDate, 'U') <= (Ext.Date.now() / 1000)) currWeek = weeks[weeks.length - 1].DateRange;
                    aDate.setDate(aDate.getDate() + 7); // Add one week
                    weekNumber++;
                } while (weekNumber <= 52);
                if (currWeek == null) currWeek = weeks[0].DateRange;
                callback(weeks, currWeek);
            }
        }
    },

    viewport: {
        update: function() {
            Ext.getBody().mask('Loading...');
            getBundlesInSelectedTimeFrame(function() {
                if (Ext.Object.getKeys(App.bundlesObj).length === 0) {
                    App.down('#viewport').removeAll();
                    Ext.getBody().unmask();
                    Ext.Msg.alert('Error', 'No bundles found for the selected week.');
                    return;
                }
                var completedWorkItemQueries = 0;
                var filter = Ext.Array.map(Ext.Object.getKeys(App.bundlesObj), function(bundle) {
                    return {
                        property : 'Release.Name',
                        value    : bundle
                    };
                });
                Ext.Array.each(['userstory','defect'], function(model) {
                    getWorkItems(model, filter, function() {
                        if (++completedWorkItemQueries === 2) aggregateRates(function() {
                            drawGrid();
                        });
                    });
                });
            });

            function getBundlesInSelectedTimeFrame(callback) {
                Ext.create('Rally.data.WsapiDataStore', {
                    model   : 'Release',
                    limit   : Infinity,
                    fetch   : ['Name','Notes','Project','ObjectID'],
                    filters : [{
                        property : 'ReleaseDate',
                        operator : '>=',
                        value    : App.down('#releaseWeek').getValue().StartDate
                    },{
                        property : 'ReleaseDate',
                        operator : '<=',
                        value    : App.down('#releaseWeek').getValue().EndDate
                    },{
                        property : 'Name',
                        operator : 'contains',
                        value    : 'BNDL'
                    }]
                }).load({
                    callback: function(store) {
                        App.bundlesObj = {};
                        Ext.Array.each(store.getItems(), function(bundle) {
                            if (App.bundlesObj[bundle.Name] === undefined)
                                App.bundlesObj[bundle.Name] = {
                                    name                : bundle.Name,
                                    project             : (bundle.Name.match(/( - )(.+)(:)/)) ? bundle.Name.match(/( - )(.+)(:)/)[2] : '',
                                    notes               : '',
                                    defectRecords       : [],
                                    userstoryRecords    : [],
                                    testcaseRecords     : []
                                };
                            if (bundle.Notes) App.bundlesObj[bundle.Name].notes += '<div><b>' + App.teamNameHash[bundle.Project.ObjectID] + ':</b> ' + Rally.util.String.stripHTML(bundle.Notes) + '</div>';
                        });
                        callback();
                    }
                });
            }

            function getWorkItems(model, filter, callback) {
                Ext.create('Rally.data.WsapiDataStore', {
                    model   : model,
                    limit   : Infinity,
                    fetch: [ 'Defects', 'FormattedID', 'FoundInBuild', 'Iteration', 'LastRun', 'LastVerdict', 'Name', 'Notes', 'ObjectID', 'Owner', 'PlanEstimate', 'Project', 'Release', 'Severity', 'ScheduleState', 'State', 'TechnicalSME', 'BusinessSME', 'TestCases'],
                    filters : Rally.data.QueryFilter.or(filter)
                }).load({
                    callback: function(store) {
                        Ext.Array.each(store.getItems(), function(item) {
                            //Set up names at root level for grid indexing
                            item.ProjectName = item.Project ? item.Project._refObjectName : '';
                            item.OwnerName   = item.Owner ? item.Owner._refObjectName     : '';
                            if (model === 'userstory') item.State = item.ScheduleState;
                            //Add record to bundle record
                            App.bundlesObj[item.Release.Name][model + 'Records'].push(item);
                            //Add child Defects and Test Cases to bundle record
                            var workProductText = '<b>' + item.FormattedID + ':</b> ' + item.Name;
                            Ext.Array.each(item.Defects, function(defect) {
                                defect.Release     = item.Release   ? item.Release._refObjectName   : '';
                                defect.ProjectName = defect.Project ? defect.Project._refObjectName : '';
                                defect.OwnerName   = defect.Owner   ? defect.Owner._refObjectName   : '';
                                defect.WorkProduct = workProductText;
                                App.bundlesObj[item.Release.Name]['defectRecords'].push(defect);
                            });
                            Ext.Array.each(item.TestCases, function(testCase) {
                                testCase.ProjectName = testCase.Project ? testCase.Project._refObjectName : '';
                                testCase.OwnerName   = testCase.Owner   ? testCase.Owner._refObjectName   : '';
                                testCase.WorkProduct = workProductText;
                                App.bundlesObj[item.Release.Name]['testcaseRecords'].push(testCase);
                            });
                        });
                        callback();
                    }
                });
            }

            function aggregateRates(callback) {
                Ext.Object.each(App.bundlesObj, function(bundleIdx) {
                    var bundle = App.bundlesObj[bundleIdx];
                    bundle.highDefectCount        = 0;
                    bundle.criticalDefectCount    = 0;
                    bundle.completedWorkItemCount = 0;
                    bundle.passedTestCaseCount    = 0;
                    Ext.Array.each(bundle.userstoryRecords, function(us) {
                        if (us.ScheduleState === 'Accepted' || us.ScheduleState === 'Completed') bundle.completedWorkItemCount++;
                    });
                    Ext.Array.each(bundle.defectRecords, function(de) {
                        if (de.State == 'Closed') {
                            bundle.completedWorkItemCount++;
                        } else {
                            if (de.Severity === 'High') bundle.highDefectCount++;
                            if (de.Severity === 'Critical') bundle.criticalDefectCount++;
                        }
                    });
                    Ext.Array.each(bundle.testcaseRecords, function(tc) {
                        if (tc.LastVerdict === 'Pass') bundle.passedTestCaseCount++;
                    });
                    bundle.completedWorkItemRate = parseFloat(bundle.completedWorkItemCount / (bundle.userstoryRecords.length + bundle.defectRecords.length)) || -1;
                    bundle.passedTestCaseRate    = parseFloat(bundle.passedTestCaseCount / bundle.testcaseRecords.length) || -1;
                });
                callback();
            }

            function drawGrid() {
                Ext.getBody().unmask();
                App.down('#viewport').removeAll();
                App.down('#viewport').add({
                    xtype             : 'rallygrid',
                    disableSelection  : true,
                    store             : Ext.create('Rally.data.custom.Store', {
                        data     : Ext.Object.getValues(App.bundlesObj),
                        pageSize : 200,
                        sorters  : [{
                            property  : 'project',
                            direction : 'ASC'
                        },{
                            property  : 'name',
                            direction : 'ASC'
                        }]
                    }),
                    columnCfgs: [{
                        text      : 'Project',
                        dataIndex : 'project',
                        width     : 75,
                        align     : 'right'
                    },{
                        text      : 'Bundle',
                        dataIndex : 'name',
                        flex      : 1
                    },{
                        text      : 'Work Item Status',
                        dataIndex : 'completedWorkItemRate',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val, meta) {
                            if (val === -1) {
                                meta.tdCls = 'grey';
                                return 'N/A';
                            } else {
                                val === 1 ? meta.tdCls = 'green' : Ext.Date.add(Rally.util.DateTime.fromIsoString(App.down('#releaseWeek').getValue().EndDate), Ext.Date.DAY, -3) < new Date() ? meta.tdCls = 'red' : meta.tdCls = 'yellow';
                                return (Math.round(val * 1000) / 10) + '%';
                            }   
                        }
                    },{
                        text      : 'Critical Defects',
                        dataIndex : 'criticalDefectCount',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val, meta) {
                            if (val === 0) {
                                return '';
                            } else {
                                meta.tdCls = 'red';
                                return val;
                            }
                        }
                    },{
                        text      : 'High Defects',
                        dataIndex : 'highDefectCount',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val, meta) {
                            if (val === 0) {
                                return '';
                            } else {
                                meta.tdCls = 'red';
                                return val;
                            }
                        }
                    },{
                        text      : 'Test Case Status',
                        dataIndex : 'passedTestCaseRate',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val, meta) {
                            if (val === -1) {
                                meta.tdCls = 'grey';
                                return 'N/A';
                            } else {
                                val === 1 ? meta.tdCls = 'green' : Ext.Date.add(Rally.util.DateTime.fromIsoString(App.down('#releaseWeek').getValue().EndDate), Ext.Date.DAY, -3) < new Date() ? meta.tdCls = 'red' : meta.tdCls = 'yellow';
                                return (Math.round(val * 1000) / 10) + '%';
                            }   
                        }
                    },{
                        text      : 'Notes',
                        dataIndex : 'notes',
                        flex      : 1
                    }],
                    listeners: {
                        itemclick: function(view, record, item, index, evt) {
                            var column = view.getPositionByEvent(evt).column;
                            if (column == 2) {
                                showPopup('User Stories',record.get('userstoryRecords').concat(record.get('defectRecords')),[
                                    { text: 'ID',            dataIndex: 'FormattedID',  width: 60,  align: 'right', renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/' + ((val.match(/US/)) ? 'userstory' : 'defect') + '/' + record.get('ObjectID') + '">' + val + '</a>'; }},
                                    { text: 'Name',          dataIndex: 'Name',         flex: 1                     },
                                    { text: 'Project',       dataIndex: 'ProjectName',  width: 175, align: 'center' },
                                    { text: 'Owner',         dataIndex: 'OwnerName',    width: 100, align: 'center' },
                                    { text: 'Severity',      dataIndex: 'Severity',     width: 100, align: 'center' },
                                    { text: 'State',         dataIndex: 'State',        width: 75,  align: 'center' },
                                    { text: 'Technical SME', dataIndex: 'TechnicalSME', width: 100, align: 'center' },
                                    { text: 'Business SME',  dataIndex: 'BusinessSME',  width: 100, align: 'center' }
                                ]);
                            } else if (column == 3 || column == 4) { //Defects
                                if ((column == 3 && record.get('criticalDefectCount') == 0) ||
                                    (column == 4 && record.get('highDefectCount')     == 0)) return;
                                showPopup('Defects',record.get('defectRecords'),[
                                    { text: 'ID',            dataIndex: 'FormattedID',  width: 60, renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/defect/' + record.get('ObjectID') + '">' + val + '</a>'; }},
                                    { text: 'Name',          dataIndex: 'Name',         flex : 1,                   },
                                    { text: 'Project',       dataIndex: 'ProjectName',  width: 175, align: 'center' },
                                    { text: 'Release',       dataIndex: 'Release',      flex : 1                    },
                                    { text: 'Owner',         dataIndex: 'OwnerName',    width: 100, align: 'center' },
                                    { text: 'State',         dataIndex: 'State',        width: 75,  align: 'center' },
                                    { text: 'Work Product',  dataIndex: 'WorkProduct',  flex : 1                    }
                                ],[{
                                    property : 'Severity',
                                    value    : (column == 3) ? 'Critical' : 'High'
                                }]);
                            } else if (column == 5) { //Test Cases
                                showPopup('Test Cases',record.get('testcaseRecords'),[
                                    { text: 'ID',            dataIndex: 'FormattedID',  width: 60, renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/testcase/' + record.get('ObjectID') + '">' + val + '</a>'; }},
                                    { text: 'Name',          dataIndex: 'Name',         flex: 1                     },
                                    { text: 'Project',       dataIndex: 'ProjectName',  width: 175, align: 'center' },
                                    { text: 'Owner',         dataIndex: 'OwnerName',    width: 100, align: 'center' },
                                    { text: 'Work Product',  dataIndex: 'WorkProduct',  flex: 1                     },
                                    { text: 'Verdict',       dataIndex: 'LastVerdict',  width: 100, align: 'center' },
                                    { text: 'Last Run',      dataIndex: 'LastRun',      width: 70,  align: 'center', renderer: function(val) { return (val != undefined) ? val.substring(0,10) : '' } }
                                ]);
                            }

                            function showPopup(title, data, columns, supFilter) {
                                if (data.length == 0) return;
                                
                                App.popup = Ext.create('Rally.ui.dialog.Dialog', {
                                    id         : 'popup',
                                    width      : Ext.getBody().getWidth(),
                                    height     : Ext.getBody().getHeight(),
                                    autoScroll : true,
                                    closable   : true,
                                    title      : record.get('Bundle') + ' - ' + title,
                                    autoShow   : true,
                                    items: [{
                                        xtype             : 'rallygrid',
                                        layout            : 'fit',
                                        showPagingtoolbar : false,
                                        disableSelection  : true,
                                        store : Ext.create('Rally.data.custom.Store', {
                                            data     : data,
                                            fields   : ['Release','FormattedID','Name','ObjectID','LastRun','ProjectName','OwnerName','Severity','ScheduleState','TechnicalSME','BusinessSME','State','WorkProduct','LastVerdict'],
                                            filters  : supFilter,
                                            sorters  : [{
                                                property  : 'FormattedID',
                                                direction : 'ASC'
                                            }],
                                            pageSize : 1000
                                        }),
                                        columnCfgs : columns
                                    }],
                                    listeners: {
                                        afterrender: function() {
                                            this.toFront();
                                            this.focus();
                                        }
                                    }
                                });

                            }
                        }
                    }
                });
            }            
        }
    }
});