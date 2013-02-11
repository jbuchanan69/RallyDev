// ERB Dashboard - Version 1.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

   	items: [{
   		xtype  : 'container',
        id     : 'toolbar',
        layout : 'hbox',
        items  : [{
            xtype : 'container',
            id    : 'week_picker_container'
        },{
            xtype    : 'container',
            defaults : {
                xtype   : 'button',
                height  : 22,
                width   : 100,
                cls     : 'btn',
                listeners : {
                    click : function() {
                        Ext.select('.selected').removeCls('selected');
                        this.addCls('selected');
                    }
                }
            },
            items : [
                { text: 'Dashboard', cls: 'btn selected', handler: function() { App.Viewport.CurrentTab = 0; App.Viewport.draw(); }},
                { text: 'Work Items',                     handler: function() { App.Viewport.CurrentTab = 1; App.Viewport.draw(); }},
                { text: 'Defects',                        handler: function() { App.Viewport.CurrentTab = 2; App.Viewport.draw(); }},
                { text: 'Test Cases',                     handler: function() { App.Viewport.CurrentTab = 3; App.Viewport.draw(); }}
            ]
        }]
   	},{
        xtype : 'container',
        id    : 'viewport'
    }],

    launch: function() {
    	Ext.state.Manager.setProvider(new Ext.state.LocalStorageProvider());
    	App = this;
        App.env = 'sandbox';
    	App.WeekPicker.init();
    },

    WeekPicker : {
    	init : function() {
    		Ext.onReady(function() {
    			// Starting with the first Sunday of the year, get all release weeks
    			var currWeek,
    				weeks = [],
    				aDate = new Date(new Date().getFullYear(), 0, 1); // First day of the year
                while (aDate.getDay() != 0) {
                    aDate.setDate(aDate.getDate() + 1);               // Add one day until aligned with a Sunday
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
    				aDate.setDate(aDate.getDate() + 7);                         // Add one week
                } while (Ext.Date.getWeekOfYear(aDate) != 1);
    			// Using the collected week information, add a combobox picker to the UI
    			App.down('#week_picker_container').add({
					xtype          : 'combo',
					id             : 'week_picker',
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
    	}
    },

    Viewport : {
        CurrentTab  : 0,
        UserStory_s : [],
        Defect_s    : [],
        TestCase_s  : [],
    	update : function() {
            Ext.onReady(function() {
                Ext.getBody().mask('Loading...');
                //Load items into respective stores
                App.Viewport.TestCase_s = [];
                getItemsInReleaseTimeFrame('UserStory', function() {
                    getItemsInReleaseTimeFrame('Defect', function() {
                        //With both stores filled, draw the currently selected tab
                        App.Viewport.draw();
                    });
                });
            });

            function getItemsInReleaseTimeFrame(item_type, callback) {
                App.Viewport[item_type + '_s'] = [];                   // Clear existing contents
                var loader = Ext.create('Rally.data.WsapiDataStore', { // Load new contents
                    model : item_type,
                    fetch : [
                        'BusinessSME',
                        'FormattedID',
                        'LastRun',
                        'LastVerdict',
                        'Name',
                        'Notes',
                        'ObjectID',
                        'Owner',
                        'Parent',
                        'Project',
                        'Release',
                        'ReleaseDate',
                        'ScheduleState',
                        'Severity',
                        'TargetDate',
                        'TechnicalSME',
                        'TestCase'
                    ],
                    filters: [
                        { property: 'Release.ReleaseDate', operator: '>=',       value: App.down('#week_picker').getValue().StartDate },
                        { property: 'Release.ReleaseDate', operator: '<=',       value: App.down('#week_picker').getValue().EndDate   },
                        { property: 'Release.Name',        operator: 'contains', value: 'BNDL'                                        }
                    ],
                    listeners: {
                        load: function(store, data) {
                            if (data && data.length) {
                                Ext.Array.each(data, function(x) {
                                    (x.raw.Owner) ? x.raw.OwnerName = x.raw.Owner._refObjectName : x.raw.OwnerName = '';
                                    (x.raw.TargetDate) ? x.raw.TargetDate = Ext.Date.format(new Date(x.raw.TargetDate), 'Y/n/j') : x.raw.TargetDate = '';
                                    if (x.raw.Release) {
                                        x.raw.Bundle = x.raw.Release._refObjectName;
                                        (x.raw.Release._refObjectName.match(/(BNDL.+?)( - )/)) ? x.raw.ReleaseName = x.raw.Release._refObjectName.match(/(BNDL.+?)( - )/)[1] : x.raw.ReleaseName = '';
                                        (x.raw.Release._refObjectName.match(/( - )(.+)(:)/))   ? x.raw.ProjectName = x.raw.Release._refObjectName.match(/( - )(.+)(:)/)[2]   : x.raw.ProjectName = '';
                                    } else {
                                        x.raw.Bundle      = '';
                                        x.raw.ReleaseName = '';
                                        x.raw.ProjectName = '';
                                    }
                                    if (x.raw.TestCase) {
                                        x.raw.TestCase.OwnerName              = x.raw.TestCase.Owner._refObjectName;
                                        x.raw.TestCase.WorkProductName        = x.raw.Name;
                                        x.raw.TestCase.WorkProductFormattedID = x.raw.FormattedID;
                                        x.raw.TestCase.WorkProductObjectID    = x.raw.ObjectID;
                                        x.raw.TestCase.Bundle                 = x.raw.Bundle;
                                        x.raw.TestCase.ProjectName            = x.raw.ProjectName;
                                        (x.raw.TestCase.LastRun) ? x.raw.TestCase.LastRun = Ext.Date.format(new Date(x.raw.TestCase.LastRun), 'Y/n/j') : x.raw.TestCase.LastRun = '';
                                        App.Viewport.TestCase_s.push(x.raw.TestCase);
                                    }
                                    App.Viewport[item_type + '_s'].push(x.raw);
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

    	},

        draw : function() {
            var renderers = [
                function() {
                    var gridObj   = {};
                    var gridArray = [];
                    Ext.Array.each(App.Viewport.Defect_s, function(d) {
                        createProjectNode(d.ProjectName, d.Bundle);
                        if (d.Severity == 'Critical' && d.ScheduleState != 'Accepted') gridObj[d.ProjectName][d.Bundle].de_Critical++;
                        if (d.Severity == 'High'     && d.ScheduleState != 'Accepted') gridObj[d.ProjectName][d.Bundle].de_High++;
                    });
                    Ext.Array.each(App.Viewport.UserStory_s, function(s) {
                        createProjectNode(s.ProjectName, s.Bundle);
                        gridObj[s.ProjectName][s.Bundle].us_Count++;
                        if (s.ScheduleState == 'Accepted') gridObj[s.ProjectName][s.Bundle].us_Accepted++;
                        //if (s.Notes) gridObj[s.ProjectName][s.Bundle].notes += '<div><b>' + s.Project._refObjectName + ':</b> ' + Rally.util.String.stripHTML(s.Notes) + '</div>';
                        if (s.Release.Notes) gridObj[s.ProjectName][s.Bundle].notes = Rally.util.String.stripHTML(s.Release.Notes);
                    });
                    Ext.Array.each(App.Viewport.TestCase_s, function(t) {
                        gridObj[t.ProjectName][t.Bundle].tc_Count++;
                        if (t.LastVerdict == 'Pass') gridObj[t.ProjectName][t.Bundle].tc_Passed++;
                    });
                    
                    // With the data loaded to the grid object, convert to an array
                    for (p in gridObj) {
                        for (b in gridObj[p]) {
                            gridArray.push({
                                Project  : p,
                                Bundle   : b,
                                WIStatus : (gridObj[p][b].us_Count > 0) ? Math.round((gridObj[p][b].us_Accepted / gridObj[p][b].us_Count) * 100) || 0 : 'N/A',
                                TCStatus : (gridObj[p][b].tc_Count > 0) ? Math.round((gridObj[p][b].tc_Passed / gridObj[p][b].tc_Count) * 100) || 0 : 'N/A',
                                Critical : gridObj[p][b].de_Critical,
                                High     : gridObj[p][b].de_High,
                                Notes    : gridObj[p][b].notes
                            });
                        }
                    }
                    // Draw grid to page
                    App.down('#viewport').add({
                        xtype : 'rallygrid',
                        disableSelection: true,
                        store : Ext.create('Rally.data.custom.Store', {
                            data    : gridArray,
                            sorters : [
                                { property: 'Project', direction: 'ASC' }
                            ]
                        }),
                        columnCfgs: [
                            { text: 'Project',    dataIndex: 'Project',  width: 85                                                                                                                                   },
                            { text: 'Bundle',     dataIndex: 'Bundle',   flex: 1                                                                                                                                     },
                            { text: 'Work Items', dataIndex: 'WIStatus', width: 85, renderer: function(val) { return '<div class="' + getNodeColor(val) + ' label">' + val + (isFinite(val) ? '%' : '') + '</div>' } },
                            { text: 'Critical',   dataIndex: 'Critical', width: 85, renderer: function(val) { return (val == 0) ? '' : '<div class="red label">' + val + '<div>' }                                   },
                            { text: 'High',       dataIndex: 'High',     width: 85, renderer: function(val) { return (val == 0) ? '' : '<div class="red label">' + val + '<div>' }                                   },
                            { text: 'Test Cases', dataIndex: 'TCStatus', width: 85, renderer: function(val) { return '<div class="' + getNodeColor(val) + ' label">' + val + (isFinite(val) ? '%' : '') + '</div>' } },
                            { text: 'Notes',      dataIndex: 'Notes',    flex: 1                                                                                                                                     }
                        ]
                    });

                    function getNodeColor(val) {
                        if (val == 'N/A') return '';
                        else if (val == 100) return 'green';                                                                                            //All work is complete
                        else if (new Date(App.down('#week_picker').getValue().StartDate) < new Date()) return 'red';                                    //Release end date has passed
                        else if (Ext.Date.add(new Date(App.down('#week_picker').getValue().StartDate), Ext.Date.DAY, -3) < new Date()) return 'yellow'; // Work is not 100% complete and release is scheduled within 3 days
                        else return '';
                    }

                    function createProjectNode(project, bundle) {
                        if (gridObj[project] == undefined) gridObj[project] = {};
                        if (gridObj[project][bundle] == undefined) gridObj[project][bundle] = {
                            us_Count    : 0,
                            us_Accepted : 0,
                            de_Critical : 0,
                            de_High     : 0,
                            tc_Count    : 0,
                            tc_Passed   : 0,
                            notes       : ''
                        };
                    }
                },
                function() {
                    App.down('#viewport').add({
                        xtype : 'rallygrid',
                        disableSelection: true,
                        model : 'UserStory',
                        store : Ext.create('Rally.data.custom.Store', {
                            data    : App.Viewport.UserStory_s,
                            sorters : [
                                { property: 'ProjectName', direction: 'ASC' }
                            ]
                        }),
                        columnCfgs: [
                            { text: 'ID',           dataIndex: 'FormattedID',   width: 60, renderer: function(value, meta, record) { return '<a href="https://' + App.env + '.rallydev.com/#/detail/userstory/' + record.get('ObjectID') + '">' + record.get('FormattedID') + '</a>'; } },
                            { text: 'Name',         dataIndex: 'Name',          flex:  1   },
                            { text: 'Project',      dataIndex: 'ProjectName',   width: 85  },
                            { text: 'Owner',        dataIndex: 'OwnerName',     width: 125 },
                            { text: 'State',        dataIndex: 'ScheduleState', width: 85  },
                            { text: 'TechnicalSME', dataIndex: 'TechnicalSME',  width: 125 },
                            { text: 'BusinessSME',  dataIndex: 'BusinessSME',   width: 125 }
                        ]
                    });
                },
                function() {
                    App.down('#viewport').add({
                        xtype : 'rallygrid',
                        disableSelection: true,
                        model : 'Defect',
                        store : Ext.create('Rally.data.custom.Store', {
                            data    : App.Viewport.Defect_s,
                            sorters : [
                                { property: 'ProjectName', direction: 'ASC' }
                            ]
                        }),
                        columnCfgs: [
                            { text: 'ID',          dataIndex: 'FormattedID',   width: 60, renderer: function(value, meta, record) { return '<a href="https://' + App.env + '.rallydev.com/#/detail/defect/' + record.get('ObjectID') + '">' + record.get('FormattedID') + '</a>'; } },
                            { text: 'Name',        dataIndex: 'Name',          flex:  1   },
                            { text: 'State',       dataIndex: 'ScheduleState', width: 85  },
                            { text: 'Project',     dataIndex: 'ProjectName',   width: 85  },
                            { text: 'Owner',       dataIndex: 'OwnerName',     width: 125 },
                            { text: 'Release',     dataIndex: 'ReleaseName',   width: 100 },
                            { text: 'Target Date', dataIndex: 'TargetDate',    width: 85  }
                        ]
                    });
                },
                function() {
                    App.down('#viewport').add({
                        xtype : 'rallygrid',
                        disableSelection: true,
                        model : 'TestCase',
                        store : Ext.create('Rally.data.custom.Store', {
                            data    : App.Viewport.TestCase_s,
                            sorters : [
                                { property: 'ProjectName', direction: 'ASC' }
                            ]
                        }),
                        columnCfgs: [
                            { text: 'ID',           dataIndex: 'FormattedID',     width: 60, renderer: function(value, meta, record) { return '<a href="https://' + App.env + '.rallydev.com/#/detail/testcase/' + record.get('ObjectID') + '">' + record.get('FormattedID') + '</a>'; } },
                            { text: 'Name',         dataIndex: 'Name',            flex:  1   },
                            { text: 'Project',      dataIndex: 'ProjectName',     width: 85  },
                            { text: 'Owner',        dataIndex: 'OwnerName',       width: 125 },
                            { text: 'Work Product', dataIndex: 'WorkProductName', flex:  1,  renderer: function(value, meta, record) { return '<a href="https://' + App.env + '.rallydev.com/#/detail/defect/' + record.get('WorkProductObjectID') + '">' + record.get('WorkProductFormattedID') + '</a> - ' + record.get('WorkProductName'); } },
                            { text: 'Verdict',      dataIndex: 'LastVerdict',     width: 85  },
                            { text: 'Last Run',     dataIndex: 'LastRun',         width: 85  }
                        ]
                    });
                }
            ];
            App.down('#viewport').removeAll();
            Ext.getBody().unmask();
            renderers[App.Viewport.CurrentTab]();
        }
    }
});