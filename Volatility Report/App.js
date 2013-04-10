// Volatility Report v0.6
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
var PANEL_WIDTH = 280;
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout:'border',
    defaults: {
        collapsible : true,
        collapsed   : false,
        autoScroll  : true,
        split       : true
    },
    items: [{
        title   : 'Project Filter:',
        id      : 'leftPopout',
        region  : 'west',
        margins : '5 0 0 0',
        width   : PANEL_WIDTH,
        items: [{
            id     : 'projectTreePopout', 
            layout : 'fit',
            border : 0,
            flex   : 1
        }],
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        }
    },{
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        },
        collapsible : false,
        region      : 'center',
        margins     : '5 0 0 0',
        defaults    : {
            border  : 0,
            padding : 3
        },
        items : [{
            id       : 'toolbar',
            layout   : 'hbox',
            height   : 30,
            defaults : {
                border : 0
            },
            items  : [{
                flex  : 1,
                items : [{
                    xtype      : 'rallyiterationcombobox',
                    id         : 'iterPicker',
                    fieldLabel : 'Iteration:',
                    labelWidth : 40,
                    width      : 300
                }] 
            },{
                id       : 'button_container',
                width    : 210,
                defaults : {
                    margin : '0 0 0 5'
                },
                items : [{
                    xtype     : 'button',
                    text      : 'Export',
                    id        : 'export_button',
                    width     : 100,
                    maxHeight : 23,
                    handler   : function() {
                        Ext.onReady(function() {
                            Ext.getBody().mask('Exporting Chart...');
                            setTimeout(function() {
                                var template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';
                                var base64   = function(s) { return window.btoa(unescape(encodeURIComponent(s))) };
                                var format   = function(s, c) { return s.replace(/{(\w+)}/g, function(m, p) { return c[p]; }) };
                                var table    = document.getElementById('rally_grid');
                                
                                var excel_data = '<tr>';
                                Ext.Array.each(table.innerHTML.match(/<span .*?x-column-header-text.*?>.*?<\/span>/gm), function(column_header_span) {
                                    excel_data += (column_header_span.replace('span','td'));
                                });
                                excel_data += '</tr><tr></tr>';
                                excel_data += table.innerHTML.replace(/\d+? ⇒ /g,'').replace(/<span .*?x-column-header-text.*?>.*?<\/span>/gm,'');
                                
                                var ctx = {worksheet: name || 'Worksheet', table: excel_data};
                                window.location.href = 'data:application/vnd.ms-excel;base64,' + base64(format(template, ctx));
                                Ext.getBody().unmask();
                            }, 500);
                        });
                    }
                },{
                    xtype     : 'button',
                    text      : 'Update',
                    width     : 100,
                    maxHeight : 23,
                    handler   : function() {
                        Ext.onReady(function() {
                            App.viewport.update();
                        });
                    }
                }] 
            }]
        },{
            id   : 'viewport',
            flex : 1,
            autoScroll : true
        }]
    },{
        title   : 'Team Filter:',
        id      : 'rightPopout',
        region  : 'east',
        margins : '5 0 0 0',
        width   : PANEL_WIDTH,
        items: [{
            id     : 'teamTreePopout', 
            layout : 'fit',
            border : 0,
            flex   : 1
        }],
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        }
    }],

    launch: function() {
        Ext.getBody().mask('Loading...');
        App = this;
        if (/*@cc_on!@*/0) { //Exporting to Excel not supported in IE
            App.down('#export_button').hide();
            App.down('#button_container').setWidth(105);
        }
        App.rpmTree.init();
        App.teamTree.init();
        //Once all UI elements are ready, do an initial query
        var uiWait = setInterval(function() {
            if (App.down('#iterPicker') && App.down('#projectTree') && App.down('#teamTree')) {
                clearInterval(uiWait);
                App.viewport.update();  
            }
        }, 500);
    },

    rpmTree: {
        init: function() {
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad: true,
                model: 'PortfolioItem/Initiative',
                fetch: ['Children','LeafStoryCount','Name','ObjectID'],
                listeners: {
                    load: function(store, data) {
                        if (data.length == 0) {
                            App.down('#leftPopout').collapse();
                            App.down('#projectTreePopout').add({
                                xtype            : 'treepanel',
                                id               : 'projectTree',
                                rootVisible      : false,
                                disableSelection : true,
                                store : Ext.create('Ext.data.TreeStore', {
                                    root: {
                                        expanded: true,
                                        children: [{
                                            text : 'N/A',
                                            leaf : true
                                        }]
                                    }
                                }),
                            });
                            return;
                        } else {
                            var roots = [];
                            Ext.Array.each(data, function(i) {
                                roots.push({
                                    name : i.raw.Name,
                                    text : '<span class="count">' + i.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + i.raw.Name + '</span>',
                                    id   : i.raw.ObjectID,
                                    leaf : i.raw.Children == undefined || i.raw.Children.length == 0
                                });
                            });
                            roots.sort(function(a, b) {
                                return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
                            });
                            drawTree(roots);
                        }
                    }
                }
            });

            function drawTree(roots) {
                App.down('#projectTreePopout').add({
                    xtype         : 'treepanel',
                    allowDeselect : true,
                    id            : 'projectTree',
                    rootVisible   : false,
                    layout        : 'fit',
                    margin        : '-1 0 0 0',
                    border        : 0,
                    store         : Ext.create('Ext.data.TreeStore', {
                        root: {
                            expanded: true,
                            children: roots
                        }
                    }),
                    listeners     : {
                        beforeitemexpand: function(node) {
                            if (node.hasChildNodes() == false) { // Child nodes have not been populated yet
                                getChildren('Rollup', function(rollup_children) {
                                    getChildren('Feature', function(feature_children) {
                                        var children = [];
                                        Ext.Array.each(rollup_children.concat(feature_children), function(c) {
                                            children.push({
                                                name : c.raw.Name,
                                                text : '<span class="count">' + c.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + c.raw.Name + '</span>',
                                                id   : c.raw.ObjectID,
                                                leaf : c.raw.Children == undefined || c.raw.Children.length == 0
                                            });
                                        });
                                        Ext.Array.each(children.sort(function(a, b) {
                                            return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
                                        }), function(n) {
                                            node.appendChild(n);
                                        });
                                    });
                                });
                            }

                            function getChildren(child_type, callback) {
                                Ext.create('Rally.data.WsapiDataStore', {
                                    autoLoad: true,
                                    model: 'PortfolioItem/' + child_type,
                                    filters: [{
                                        property: 'Parent.ObjectID',
                                        value: node.raw.id
                                    }],
                                    fetch: ['Children','LeafStoryCount','Name','ObjectID'],
                                    listeners: {
                                        load: function(store, data) {
                                            callback(data);
                                        }
                                    }
                                });
                            }

                        }
                    }
                });
                
            }
        }
    },

    teamTree: {
        init: function() {
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad: true,
                model: 'Project',
                fetch: [ 'Children', 'Name', 'ObjectID' ],
                filters: [ { property: 'Parent', value: null } ],
                listeners: {
                    load: function(model, roots) {
                        var nodes = [];
                        Ext.Array.each(roots, function(root) {
                            nodes.push({
                                name : root.get('Name'),
                                text : root.get('Name'),
                                id   : root.get('ObjectID'),
                                leaf : root.raw.Children == undefined || root.raw.Children.length == 0,
                            });
                        });
                        //Add tree to UI element
                        App.down('#teamTreePopout').add({
                            xtype         : 'treepanel',
                            allowDeselect : true,
                            id            : 'teamTree',
                            rootVisible   : false,
                            margin        : '-1 0 0 0',
                            border        : 0,
                            layout        : 'fit',
                            store         : Ext.create('Ext.data.TreeStore', {
                                root: {
                                    expanded : true,
                                    children : nodes
                                }
                            }),
                            listeners: {
                                beforeitemexpand: function(node) {
                                    nodes = [];
                                    var childLoader = Ext.create('Rally.data.WsapiDataStore', {
                                        model: 'Project',
                                        fetch: [ 'Children', 'Name', 'ObjectID' ],
                                        filters: [ { property: 'Parent.ObjectID', value: node.get('id') } ],
                                        listeners: {
                                            load: function(model, children) {
                                                Ext.Array.each(children, function(child) {
                                                    nodes.push({
                                                        name : child.get('Name'),
                                                        text : child.get('Name'),
                                                        id   : child.get('ObjectID'),
                                                        leaf : child.raw.Children == undefined || child.raw.Children.length == 0
                                                    });
                                                });
                                            }
                                        }
                                    });
                                    if (node.hasChildNodes() == false) {
                                        childLoader.loadPages({
                                            callback: function() {
                                                Ext.Array.each(nodes.sort(function(a, b) {
                                                    return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
                                                }), function(n) {
                                                    node.appendChild(n);
                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        });     
                    }
                }
            });
        }
    },

    viewport: {
        update: function() {
            Ext.getBody().mask('Loading...');
            var aDate           = Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(App.down('#iterPicker').getRecord().get('StartDate')), Ext.Date.DAY, 2)),
                bDate           = Rally.util.DateTime.toIsoString(new Date(App.down('#iterPicker').getRecord().get('EndDate'))),
                iterOIDs        = [],
                projectNameHash = {};
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad : true,
                model    : 'Iteration',
                fetch    : ['Name','ObjectID','Project'],
                filters  : [{
                    property : 'Name',
                    value    : App.down('#iterPicker').getRawValue()
                }],
                listeners: {
                    load: function(store, data) {
                        Ext.Array.each(data, function(i) {
                            projectNameHash[i.raw.Project.ObjectID] = i.raw.Project._refObjectName;
                            iterOIDs.push(i.raw.ObjectID);
                        });

                        getDataOn(aDate, function(aStories) {
                            getDataOn(bDate, function(bStories) {
                                var gridObj         = {},
                                    gridArray       = [],
                                    userStoryCount  = 0,
                                    taskEstimateSum = 0,
                                    taskActualSum   = 0,
                                    taskRemainSum   = 0;
                                
                                //Mark added stories
                                for (b in bStories) {
                                    gridObj[b] = bStories[b];
                                    gridObj[b].EstVsActHours = (bStories[b].TaskEstimateTotal == 0) ? 1 : parseFloat(bStories[b].TaskActualTotal / bStories[b].TaskEstimateTotal) || 0.0;
                                    if (aStories[b] == undefined) gridObj[b].ARC = 2; //Added
                                    gridObj[b].CurrentState = bStories[b].ScheduleState;
                                }

                                //Mark removed/changed stories
                                for (a in aStories) {
                                    if (gridObj[a] == undefined) gridObj[a] = aStories[a];
                                    if (bStories[a] == undefined) {
                                        gridObj[a].ARC = 1; //Removed
                                    } else if (aStories[a].PlanEstimate != bStories[a].PlanEstimate) {
                                        gridObj[a].ARC = 0; //Changed
                                        gridObj[a].PlanEstimate = ((aStories[a].PlanEstimate === undefined) ? 'N/A' : aStories[a].PlanEstimate) + ' &rArr; ' + ((bStories[a].PlanEstimate === undefined) ? 'N/A' : bStories[a].PlanEstimate)
                                    }
                                    gridObj[a].InitialState = aStories[a].ScheduleState;
                                }

                                for (o in gridObj) {
                                    if (gridObj[o].ARC == undefined) gridObj[o].ARC = -1;
                                    //Stats
                                    userStoryCount++;
                                    taskEstimateSum += gridObj[o].TaskEstimateTotal;
                                    taskActualSum   += gridObj[o].TaskActualTotal;
                                    taskRemainSum   += gridObj[o].TaskRemainingTotal;
                                    gridArray.push(gridObj[o]);
                                }

                                var gridStore = Ext.create('Rally.data.custom.Store', {
                                    data       : gridArray,
                                    fields     : ['ARC','InitialState','CurrentState','_UnformattedID','Name','ObjectID','PlanEstimate','Team','TaskActualTotal','TaskEstimateTotal','TaskRemainingTotal','EstVsActHours'],
                                    groupField : 'Team',
                                    pageSize   : 10000,
                                    sorters    : [
                                        { property: 'Team',           direction: 'ASC'  },
                                        { property: 'ARC',            direction: 'DESC' },
                                        { property: '_UnformattedID', direction: 'ASC'  }
                                    ]
                                });

                                //Render the grid to the viewport
                                App.down('#viewport').removeAll();
                                App.down('#viewport').add({
                                    xtype             : 'rallygrid',
                                    id                : 'rally_grid',
                                    disableSelection  : true,
                                    showPagingToolbar : false,
                                    store             : gridStore,
                                    features: [
                                        Ext.create('Ext.grid.feature.Grouping', {
                                            groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
                                        }),{
                                            ftype: 'summary'
                                        }
                                    ],
                                    columnCfgs: [{
                                        text      : '',
                                        dataIndex : 'ARC',
                                        width     : 25,
                                        renderer  : function(val) {
                                            return (val >= 0) ? '<div class="' + ['yellow','red','green'][val] + ' label square">' + ['C','-','+'][val] + '</div>' : '';
                                        }
                                    },{
                                        text      : 'ID',
                                        dataIndex : '_UnformattedID',
                                        width     : 60,
                                        renderer  : function(val, meta, record) {
                                            return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('ObjectID') + '">US' + val + '</a>';
                                        }
                                    },{
                                        text      : 'Name',
                                        dataIndex : 'Name',
                                        flex      : 1
                                    },{
                                        text      : 'Plan Estimate Points',
                                        dataIndex : 'PlanEstimate',
                                        width     : 90,
                                        align     : 'center'
                                    },{
                                        text      : 'Actual vs Estimated Hours',
                                        dataIndex : 'EstVsActHours',
                                        width     : 130,
                                        resizable : false,
                                        align     : 'center',
                                        renderer  : function(val, meta, record) {
                                            return '<div class="label"><span class="align">' + Math.round(val * 100) + '% </span><span class="align"> ' + Math.round(record.get('TaskActualTotal')) + ' / ' + Math.round(record.get('TaskEstimateTotal')) + '</span></div>';
                                        }
                                    },{
                                        text      : 'Remaining Hours',
                                        dataIndex : 'TaskRemainingTotal',
                                        width     : 65,
                                        align     : 'center'
                                    },{
                                        text      : 'Initial State',
                                        dataIndex : 'InitialState',
                                        width     : 90,
                                        align     : 'center',
                                        renderer  : function(val) {
                                            return (!val) ? 'N/A' : val;
                                        }
                                    },{
                                        text      : 'Current State',
                                        dataIndex : 'CurrentState',
                                        width     : 90,
                                        align     : 'center',
                                        renderer  : function(val) {
                                            return (!val) ? 'N/A' : val;
                                        }
                                    }]
                                });
                                App.down('#viewport').add({
                                    border : 0,
                                    html   : '<div class="gridSummary">Total User Stories: ' + Ext.util.Format.number(userStoryCount, '0,000') + '<br />Task Estimate: ' + Ext.util.Format.number(taskEstimateSum, '0,000.00') + ' Hours<br />Task Actual: ' + Ext.util.Format.number(taskActualSum, '0,000.00') + ' Hours<br />Task Remaining: ' + Ext.util.Format.number(taskRemainSum, '0,000.00') + ' Hours</div>'
                                });
                                Ext.getBody().unmask();
                            });
                        });

                        function getDataOn(date, callback) {
                            var filter = [
                                { property: '__At',                            value: date                      },
                                { property: '_TypeHierarchy',                  value: 'HierarchicalRequirement' },
                                { property: 'Iteration',      operator : 'in', value: iterOIDs                  }
                            ];
                            if (App.down('#projectTree').getSelectionModel().getSelection().length) {
                                filter.push({property: '_ItemHierarchy', value: App.down('#projectTree').getSelectionModel().getSelection()[0].raw.id });
                            }
                            if (App.down('#teamTree').getSelectionModel().getSelection().length) {
                                filter.push({ property: '_ProjectHierarchy', value: App.down('#teamTree').getSelectionModel().getSelection()[0].raw.id });
                            }
                            Ext.create('Rally.data.lookback.SnapshotStore', {
                                autoLoad  : true,
                                filters   : filter,
                                fetch     : ['_UnformattedID','Name','PlanEstimate','Project','ScheduleState','TaskActualTotal','TaskEstimateTotal','TaskRemainingTotal'],
                                hydrate   : ['ScheduleState'],
                                pageSize  : 10000,
                                listeners : {
                                    load: function(store, data) {
                                        var stories = {};
                                        Ext.Array.each(data, function(i) {
                                            i.raw.Team = projectNameHash[i.raw.Project];
                                            stories[i.raw.ObjectID] = i.raw;
                                        });
                                        callback(stories);
                                    }
                                }
                            });
                        }
                    }
                }
            });
        }
    }
});