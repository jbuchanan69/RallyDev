
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
        title   : 'Project',
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
                width : 102,
                items : [{
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
            layout : 'hbox',
            id     : 'viewport',
            items  : [{
                xtype : 'container',
                id    : 'aGrid',
                width : '50%'
            },{
                xtype : 'container',
                id    : 'bGrid',
                width : '50%'
            }]
        }]
    },{
        title   : 'Team',
        region  : 'east',
        margins : '5 0 0 0',
        width   : PANEL_WIDTH,
        items: [{
            id     : 'teamTreePopout', 
            layout : 'fit',
            border : 0,
            flex   : 1
        }]
    }],

    launch: function() {
        App = this;
        App.rpmTree.init();
        App.teamTree.init();
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
                            App.removeAll();
                            Ext.getBody().unmask();
                            Ext.Msg.alert('Error', '<div class="error">This app must be ran within a context which features Initiative Portfolio Items.<br />Please change your project scope and try again.</div>');
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
            var aDate = Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(App.down('#iterPicker').getRecord().get('StartDate')), Ext.Date.DAY, 2));
            var bDate = Rally.util.DateTime.toIsoString(new Date(App.down('#iterPicker').getRecord().get('EndDate')));
            var iterOIDs = [];
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad : true,
                model    : 'Iteration',
                fetch    : ['ObjectID'],
                filters  : [{
                    property : 'Name',
                    value    : App.down('#iterPicker').getRawValue()
                }],
                listeners: {
                    load: function(store, data) {
                        Ext.Array.each(data, function(i) {
                            iterOIDs.push(i.raw.ObjectID);
                        });

                        getDataOn(aDate, function(aStories) {
                            getDataOn(bDate, function(bStories) {
                                var aStoryArray = [],
                                    bStoryArray = [];
                                //Mark removed/changed stories
                                for (a in aStories) {
                                    aStories[a].EstVsActHours = (aStories[a].TaskEstimateTotal == 0) ? 1 : parseFloat(aStories[a].TaskActualTotal / aStories[a].TaskEstimateTotal) || 0.0;
                                    if (bStories[a] == undefined) {
                                        aStories[a].ARC = 1;
                                    } else if (aStories[a].PlanEstimate != bStories[a].PlanEstimate) {
                                        aStories[a].ARC = 2;
                                        bStories[a].ARC = 2;
                                    } else {
                                        aStories[a].ARC = -1;
                                    }
                                    aStoryArray.push(aStories[a]);
                                }
                                //Mark added stories
                                for (b in bStories) {
                                    bStories[b].EstVsActHours = (bStories[b].TaskEstimateTotal == 0) ? 1 : parseFloat(bStories[b].TaskActualTotal / bStories[b].TaskEstimateTotal) || 0.0;
                                    if (aStories[b] == undefined) {
                                        bStories[b].ARC = 0;
                                    } else if (bStories[b].ARC == undefined) {
                                        bStories[b].ARC = -1;
                                    }
                                    bStoryArray.push(bStories[b]);
                                }

                                drawGrid(App.down('#aGrid'), aStoryArray);
                                drawGrid(App.down('#bGrid'), bStoryArray);

                                function drawGrid(grid_container, grid_store) {
                                    grid_container.removeAll();
                                    grid_container.add({
                                        xtype             : 'rallygrid',
                                        disableSelection  : true,
                                        showPagingToolbar : false,
                                        store             : Ext.create('Rally.data.custom.Store', {
                                            data     : grid_store,
                                            fields   : ['ARC','_UnformattedID','Name','PlanEstimate','ScheduleState','TaskActualTotal','TaskEstimateTotal','EstVsActHours'],
                                            pageSize : 10000,
                                            sorters  : [
                                                { property: 'ARC',            direction: 'DESC' },
                                                { property: '_UnformattedID', direction: 'ASC'  }
                                            ]
                                        }),
                                        columnCfgs: [{
                                            text: '',
                                            dataIndex: 'ARC',
                                            width: 25,
                                            renderer: function(val) {
                                                return (val >= 0) ? '<div class="' + ['green','red','yellow'][val] + ' label square">' + ['+','-','C'][val] + '</div>' : '';
                                            }
                                        },{
                                            text: 'ID',
                                            dataIndex: '_UnformattedID',
                                            width: 60,
                                            renderer: function(val) {
                                                return 'US' + val;
                                            }
                                        },{
                                            text: 'Name',
                                            dataIndex: 'Name',
                                            flex: 1
                                        },{
                                            text: 'Plan Estimate Points',
                                            dataIndex: 'PlanEstimate',
                                            width: 60,
                                            align: 'center'
                                        },{
                                            text      : 'Actual vs Estimated Hours',
                                            dataIndex : 'EstVsActHours',
                                            width     : 130,
                                            align     : 'center',
                                            renderer  : function(val, meta, record) {
                                                return '<div class="label"><div class="align">' + Math.round(val * 100) + '%</div><div class="align">' + Math.round(record.get('TaskActualTotal')) + ' / ' + Math.round(record.get('TaskEstimateTotal')) + '</div></div>';
                                            }
                                        },{
                                            text: 'State',
                                            dataIndex: 'ScheduleState',
                                            width: 90,
                                            align: 'center'
                                        }]
                                    });
                                }

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
                                fetch     : ['_UnformattedID','Name','PlanEstimate','ScheduleState','TaskActualTotal','TaskEstimateTotal'],
                                hydrate   : ['ScheduleState'],
                                pageSize  : 10000,
                                listeners : {
                                    load: function(store, data) {
                                        var stories = {};
                                        Ext.Array.each(data, function(i) {
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