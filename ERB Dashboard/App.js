// ERB Dashboard - Version 2.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

    items:[{
        xtype : 'container',
        id    : 'toolbar'
    },{
        xtype : 'container',
        id    : 'viewport'
    }],

	launch: function() {
        App = this;
        //Initialize the week picker combo box
        Ext.onReady(function() {
            // Starting with the first Sunday of the year, get all release weeks
            var currWeek,
                weeks = [],
                aDate = new Date(new Date().getFullYear(), 0, 1); // First day of the year
            while (aDate.getDay() != 1) {
                aDate.setDate(aDate.getDate() - 1); // Add one day until aligned with a Sunday
            }
            do {
                weeks.push({
                    Name      : 'Week ' + Ext.Date.getWeekOfYear(aDate) + ': ' + Ext.Date.format(aDate, 'M j') + ' - ' + Ext.Date.format(Ext.Date.add(aDate, Ext.Date.DAY, 6), 'M j'),
                    DateRange : {
                        StartDate : Rally.util.DateTime.toIsoString(aDate),
                        EndDate   : Rally.util.DateTime.toIsoString(Ext.Date.add(aDate, Ext.Date.MILLI, 604799999))
                    }
                });
                if (Ext.Date.format(aDate, 'U') <= (Ext.Date.now() / 1000)) currWeek = weeks[weeks.length - 1].DateRange;
                aDate.setDate(aDate.getDate() + 7); // Add one week
            } while (Ext.Date.getWeekOfYear(aDate) != 1);
            // Using the collected week information, add a combobox picker to the UI
            App.down('#toolbar').add({
                xtype          : 'combo',
                id             : 'weekPicker',
                fieldLabel     : 'Release Week',
                labelWidth     : 75,
                width          : 250,
                editable       : false,
                forceSelection : true,
                queryMode      : 'local',
                displayField   : 'Name',
                valueField     : 'DateRange',
                value          : currWeek,
                store: {
                    fields: ['Name','DateRange'],
                    data: weeks
                },
                listeners   : {
                    change  : App.Viewport.update,
                    added   : App.Viewport.update
                }
            });
        });

        App.down('#viewport').addListener('resize', function() {
            if (App.popup) {
                App.popup.setWidth(Ext.getBody().getWidth());
                App.popup.setHeight(Ext.getBody().getHeight());
            }
        });

	},

    Viewport: {
        update: function() {
            Ext.getBody().mask('Loading...');
            var gridData  = {};
            var gridArray = [];
            getData('UserStory', function() {
                getData('Defect', function() {
                    //Process data into grid array
                    var bNode;
                    for (b in gridData) {
                        bNode = {
                            Project       : (b.match(/( - )(.+)(:)/)) ? b.match(/( - )(.+)(:)/)[2] : '',
                            Bundle        : b,
                            US_Acpt_Count : 0,
                            DE_Crit_Count : 0,
                            DE_High_Count : 0,
                            DE_Clos_Count : 0,
                            TC_Pass_Count : 0,
                            Notes         : '',
                            US_Store      : gridData[b].UserStories,
                            DE_Store      : gridData[b].Defects,
                            TC_Store      : gridData[b].TestCases
                        };
                        for (us in gridData[b].UserStories) {
                            if (gridData[b].UserStories[us].ScheduleState == 'Accepted') bNode.US_Acpt_Count++;
                        }
                        for (d in gridData[b].Defects) {
                            if (gridData[b].Defects[d].State == 'Closed') {
                                bNode.DE_Clos_Count++;
                            } else {
                                if (gridData[b].Defects[d].Severity == 'Critical') bNode.DE_Crit_Count++;
                                if (gridData[b].Defects[d].Severity == 'High'    ) bNode.DE_High_Count++;
                            }
                        }
                        for (tc in gridData[b].TestCases) {
                            if (gridData[b].TestCases[tc].LastVerdict == 'Pass') bNode.TC_Pass_Count++;
                        }
                        for (n in gridData[b].Notes) {
                            bNode.Notes += '<div>' + gridData[b].Notes[n] + '</div>';
                        }
                        bNode.WI_Acpt_Rate = ((bNode.US_Store.length + bNode.DE_Store.length) == 0) ? 'N/A' : parseFloat((bNode.US_Acpt_Count + bNode.DE_Clos_Count) / (bNode.US_Store.length + bNode.DE_Store.length));
                        bNode.TC_Pass_Rate = (bNode.TC_Store.length == 0) ? 'N/A' : parseFloat(bNode.TC_Pass_Count / bNode.TC_Store.length);
                        gridArray.push(bNode);
                    }
                    drawGrid();
                });
            });

            function getData(data_type, callback) {
                var loader = Ext.create('Rally.data.WsapiDataStore', {
                    model: data_type,
                    fetch: [
                        'Defects',      'FormattedID', 'FoundInBuild', 'Iteration', 'LastVerdict',   'Name',  'Notes',        'ObjectID',    'Owner',
                        'PlanEstimate', 'Project',     'Release',      'Severity',  'ScheduleState', 'State', 'TechnicalSME', 'BusinessSME', 'TestCases'
                    ],
                    filters: [
                        { property: 'Release.Name',        operator: 'contains', value: 'BNDL'                                       },
                        { property: 'Release.ReleaseDate', operator: '>=',       value: App.down('#weekPicker').getValue().StartDate },
                        { property: 'Release.ReleaseDate', operator: '<=',       value: App.down('#weekPicker').getValue().EndDate   }
                    ],
                    listeners: {
                        load: function(store, data) {
                            if (data && data.length) {
                                Ext.Array.each(data, function(x) {
                                    // Create bundle node if new
                                    if (gridData[x.raw.Release._refObjectName] == undefined) {
                                        gridData[x.raw.Release._refObjectName] = {
                                            UserStories : [],
                                            Defects     : [],
                                            TestCases   : [],
                                            Notes       : []
                                        }
                                    }
                                    // Add data to store
                                    x.raw.ProjectName = (x.raw.Project) ? x.raw.Project._refObjectName : '';
                                    x.raw.OwnerName   = (x.raw.Owner)   ? x.raw.Owner._refObjectName   : '';
                                    if (data_type === 'UserStory') {
                                        x.raw.State = x.raw.ScheduleState;
                                        gridData[x.raw.Release._refObjectName].UserStories.push(x.raw);
                                    } else if (data_type === 'Defect') {
                                        x.raw.ParentText = '';
                                        gridData[x.raw.Release._refObjectName].Defects.push(x.raw);
                                    }
                                    Ext.Array.each(x.raw.Defects, function(d) {
                                        d.ProjectName = (d.Project) ? d.Project._refObjectName : '';
                                        d.OwnerName   = (d.Owner)   ? d.Owner._refObjectName   : '';
                                        d.ParentText  = '<b>' + x.raw.FormattedID + ': </b>' + x.raw._refObjectName;
                                        gridData[x.raw.Release._refObjectName].Defects.push(d);
                                    });
                                    Ext.Array.each(x.raw.TestCases, function(t) {
                                        t.ProjectName = (t.Project) ? t.Project._refObjectName : '';
                                        t.OwnerName   = (t.Owner)   ? t.Owner._refObjectName   : '';
                                        t.ParentText  = '<b>' + x.raw.FormattedID + ': </b>' + x.raw._refObjectName;
                                        gridData[x.raw.Release._refObjectName].TestCases.push(t);
                                    });
                                    if (x.raw.Release.Notes && Ext.Array.indexOf(gridData[x.raw.Release._refObjectName].Notes, '<b>' + x.raw.Project._refObjectName + '</b>: ' + Rally.util.String.stripHTML(x.raw.Release.Notes)) == -1)
                                        gridData[x.raw.Release._refObjectName].Notes.push('<b>' + x.raw.Project._refObjectName + '</b>: ' + Rally.util.String.stripHTML(x.raw.Release.Notes));
                                });
                                loader.nextPage();
                            } else {
                                callback();
                            }
                        }
                    }
                });
                loader.loadPage(1);
            }

            function drawGrid() {
                Ext.getBody().unmask();
                App.down('#viewport').removeAll();
                App.down('#viewport').add({
                    xtype: 'rallygrid',
                    disableSelection: true,
                    showPagingToolbar: false,
                    store: Ext.create('Rally.data.custom.Store', {
                        data     : gridArray,
                        pageSize : 1000
                    }),
                    columnCfgs: [{
                        text      : 'Project',
                        dataIndex : 'Project',
                        width     : 75
                    },{
                        text      : 'Bundle',
                        dataIndex : 'Bundle',
                        flex      : 1
                    },{
                        text      : 'Work Item Status',
                        dataIndex : 'WI_Acpt_Rate',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val) {
                            var color = (val == 1) ? 'green' : (Ext.Date.add(new Date(App.down('#weekPicker').getValue().EndDate), Ext.Date.DAY, -3) < new Date()) ? 'red' : '';
                            return '<div class="' + color + ' label">' + parseInt(val * 100) + '%<div>';
                        }
                    },{
                        text      : 'Critical Defects',
                        dataIndex : 'DE_Crit_Count',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val) {
                            return (val == 0) ? '' : '<div class="red label">' + val + '</div>';
                        }
                    },{
                        text      : 'High Defects',
                        dataIndex : 'DE_High_Count',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val) {
                            return (val == 0) ? '' : '<div class="red label">' + val + '</div>';
                        }
                    },{
                        text      : 'Test Case Status',
                        dataIndex : 'TC_Pass_Rate',
                        width     : 75,
                        align     : 'center',
                        resizable : false,
                        renderer  : function(val) {
                            if (val == 'N/A') {
                                return val;
                            } else {
                                var color = (val == 1) ? 'green' : (Ext.Date.add(new Date(App.down('#weekPicker').getValue().EndDate), Ext.Date.DAY, -3) < new Date()) ? 'red' : '';
                                return '<div class="' + color + ' label">' + parseInt(val * 100) + '%<div>'; 
                            }
                        }
                    },{
                        text      : 'Notes',
                        dataIndex : 'Notes',
                        flex      : 1
                    }],
                    listeners: {
                        itemclick: function(view, record, item, index, evt) {
                            var column = view.getPositionByEvent(evt).column;
                            if (column == 2) {
                                showPopup('User Stories',record.get('US_Store').concat(record.get('DE_Store')),[
                                    { text: 'ID',            dataIndex: 'FormattedID',   width: 60, renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/' + ((val.match(/US/)) ? 'userstory' : 'defect') + '/' + record.get('ObjectID') + '">' + val + '</a>'; }},
                                    { text: 'Name',          dataIndex: 'Name',          flex: 1    },
                                    { text: 'Project',       dataIndex: 'ProjectName',   width: 175 },
                                    { text: 'Owner',         dataIndex: 'OwnerName',     width: 100 },
                                    { text: 'Severity',      dataIndex: 'Severity',      width: 100 },
                                    { text: 'State',         dataIndex: 'State',         width: 75  },
                                    { text: 'Technical SME', dataIndex: 'TechnicalSME',  width: 100 },
                                    { text: 'Business SME',  dataIndex: 'BusinessSME',   width: 100 }
                                ]);
                            } else if (column == 3 || column == 4) { //Defects
                                if ((column == 3 && record.get('DE_Crit_Count') == 0) ||
                                    (column == 4 && record.get('DE_High_Count') == 0)) return;
                                showPopup('Defects',record.get('DE_Store'),[
                                    { text: 'ID',            dataIndex: 'FormattedID',   width: 60, renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/defect/' + record.get('ObjectID') + '">' + val + '</a>'; }},
                                    { text: 'Name',          dataIndex: 'Name',          flex: 1    },
                                    { text: 'Project',       dataIndex: 'ProjectName',   width: 175 },
                                    { text: 'Owner',         dataIndex: 'OwnerName',     width: 100 },
                                    { text: 'State',         dataIndex: 'State',         width: 75  },
                                    { text: 'Work Product',  dataIndex: 'ParentText',    flex: 1    }
                                ],[{
                                    property : 'Severity',
                                    value    : (column == 3) ? 'Critical' : 'High'
                                }]);
                            } else if (column == 5) {
                                showPopup('Test Cases',record.get('TC_Store'),[
                                    { text: 'ID',            dataIndex: 'FormattedID',   width: 60, renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/testcase/' + record.get('ObjectID') + '">' + val + '</a>'; }},
                                    { text: 'Name',          dataIndex: 'Name',          flex: 1    },
                                    { text: 'Project',       dataIndex: 'ProjectName',   width: 175 },
                                    { text: 'Owner',         dataIndex: 'OwnerName',     width: 100 },
                                    { text: 'Work Product',  dataIndex: 'ParentText',    flex: 1    },
                                    { text: 'Verdict',       dataIndex: 'LastVerdict',   width: 60  }
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
                                        showPagingToolbar : false,
                                        disableSelection  : true,
                                        store : Ext.create('Rally.data.custom.Store', {
                                            data     : data,
                                            fields   : ['FormattedID','Name','ObjectID','ProjectName','OwnerName','Severity','ScheduleState','TechnicalSME','BusinessSME','State','ParentText','LastVerdict'],
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