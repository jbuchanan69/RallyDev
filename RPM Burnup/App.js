// RPM Burnup - Version 3.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout:'border',
    defaults: {
        autoScroll : true,
        split      : true,
        margins    : '5 0 5 0'
    },
    items: [{
        title   : 'Project',
        id      : 'leftPopout',
        region  : 'west',
        collapsible : true,
        width   : 300,
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start'
        },
        items: [{
            xtype  : 'container',
            id     : 'rpmTreeContainer', 
            layout : 'fit',
            flex   : 1,
            style  : {
                borderBottom : '1px solid #99BCE8'
            }
        },{
            id      : 'settings',
            height  : 75,
            border  : 0,
            margins : 4,
            items: [{
                xtype       : 'container',
                id          : 'rpm_level_info'
            },{
                xtype       : 'checkbox',
                id          : 'showFuture',
                fieldLabel  : 'Show Planned Iterations:',
                width       : 285,
                labelWidth  : 150,
                labelAlign  : 'right',
                checked     : true,
                listeners   : {
                    change  : function() {
                        Ext.onReady(function() {
                            if (App.down('#rpmTree').getSelectionModel().getSelection().length > 0) App.viewport.update();
                        });
                    }
                }
            },{
                xtype      : 'datefield',
                id         : 'min_date',
                width      : 285,
                showToday  : false,
                fieldLabel : 'Chart Start Date:',
                labelWidth : 150,
                labelAlign : 'right',
                value      : new Date(),
                listeners  : {
                    change : function() {
                        Ext.onReady(function() {
                            if (App.datePickerListen) App.viewport.populateGrid();
                        });
                    }
                }
            },{
                xtype      : 'datefield',
                id         : 'max_date',
                width      : 285,
                showToday  : false,
                fieldLabel : 'Chart End Date:',
                labelWidth : 150,
                labelAlign : 'right',
                value      : new Date(),
                listeners  : {
                    change : function() {
                        Ext.onReady(function() {
                            if (App.datePickerListen) App.viewport.populateGrid();
                        });
                    }
                }
            }]
        }]
    },{
        id     : 'viewport',
        region : 'center'
    }],

    launch: function() {
        App = this;
        App.rpmTree.init();
        App.iterations.getFuture();
        App.down('#viewport').addListener('resize', function() {
            if (App.down('#chart')) {
                App.down('#chart').setWidth(Ext.get('viewport').getWidth() - 25);
                App.down('#chart').setHeight(Ext.get('viewport').getHeight() - 40);
            }
        });
    },

    rpmTree: {
        init: function() {
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad: true,
                model: 'PortfolioItem/Initiative',
                fetch: [
                    'Children',
                    'LeafStoryCount',
                    'AcceptedLeafStoryCount',
                    'Name',
                    'ObjectID',
                    'PlannedStartDate',
                    'PlannedEndDate'
                ],
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
                                    name   : i.raw.Name,
                                    text   : '<span class="count">' + i.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + i.raw.Name + '</span>',
                                    id     : i.raw.ObjectID,
                                    leaf   : i.raw.Children == undefined || i.raw.Children.length == 0,
                                    pStart : i.raw.PlannedStartDate,
                                    pEnd   : i.raw.PlannedEndDate,
                                    usCnt  : i.raw.LeafStoryCount,
                                    acpCnt : i.raw.AcceptedLeafStoryCount
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
                App.down('#rpmTreeContainer').add({
                    xtype        : 'treepanel',
                    store        : Ext.create('Ext.data.TreeStore', {
                        root: {
                            expanded: true,
                            children: roots
                        }
                    }),
                    id           : 'rpmTree',
                    rootVisible  : false,
                    margin       : '-1 0 0 0',
                    border       : 0,
                    listeners    : {
                        beforeitemexpand: function(node) {
                            if (node.hasChildNodes() == false) { // Child nodes have not been populated yet
                                getChildren('Rollup', function(rollup_children) {
                                    getChildren('Feature', function(feature_children) {
                                        var children = [];
                                        Ext.Array.each(rollup_children.concat(feature_children), function(c) {
                                            children.push({
                                                name   : c.raw.Name,
                                                text   : '<span class="count">' + c.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + c.raw.Name + '</span>',
                                                id     : c.raw.ObjectID,
                                                leaf   : c.raw.Children == undefined || c.raw.Children.length == 0,
                                                pStart : c.raw.PlannedStartDate,
                                                pEnd   : c.raw.PlannedEndDate,
                                                usCnt  : c.raw.LeafStoryCount,
                                                acpCnt : c.raw.AcceptedLeafStoryCount
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
                                    autoLoad : true,
                                    model    : 'PortfolioItem/' + child_type,
                                    filters  : [{
                                        property : 'Parent.ObjectID',
                                        value    : node.raw.id
                                    }],
                                    fetch: [
                                        'Children',
                                        'LeafStoryCount',
                                        'AcceptedLeafStoryCount',
                                        'Name',
                                        'ObjectID',
                                        'PlannedStartDate',
                                        'PlannedEndDate'
                                    ],
                                    listeners : {
                                        load: function(store, data) {
                                            callback(data);
                                        }
                                    }
                                });
                            }

                        },
                        selectionchange: function() {
                            App.viewport.update();
                        }
                    }
                });
                
            }
        }
    },

    iterations: {
        dateHash: {},
        loaded: false,
        getFuture: function() {
            var loader = Ext.create('Rally.data.WsapiDataStore', {
                model     : 'Iteration',
                fetch     : ['ObjectID','StartDate'],
                filters   : [{
                    property : 'StartDate',
                    operator : '>=',
                    value    : Rally.util.DateTime.toIsoString(new Date())
                },{
                    property : 'StartDate',
                    operator : '<=',
                    value    : Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(), Ext.Date.YEAR, 2)) //Ignore iterations scheduled to arbitrary dates in the future (Max 2 years out)
                }],
                sorters : [{
                    property : 'StartDate',
                    direction : 'DESC'
                }],
                listeners : {
                    load : function(store, data) {
                        if (data && data.length) {
                            var aDate, bDate;
                            Ext.Array.each(data, function(i) {
                                var aDate = Ext.Date.clearTime(Rally.util.DateTime.fromIsoString(i.raw.StartDate));
                                while (aDate.getDay() !== 0) { aDate = Ext.Date.add(aDate, Ext.Date.DAY, -1); }
                                App.iterations.dateHash[i.raw.ObjectID] = Rally.util.DateTime.toIsoString(aDate);
                            });
                            loader.nextPage();
                        } else {
                            App.iterations.loaded = true;
                        }
                    }
                }
            });
            loader.loadPage(1);
        }
    },

    projectStats: {
        getBlockedStoryCount: function(callback) {
            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad : true,
                pageSize : 1,
                fetch    : ['PlanEstimate','Iteration'],
                filters  : [{
                    property : '__At',
                    value    : 'current'
                },{
                    property : '_TypeHierarchy',
                    value    : 'HierarchicalRequirement'
                },{
                    property : '_ItemHierarchy',
                    operator : 'in',
                    value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
                },{
                    property : 'Children',
                    value    : null
                },{
                    property : 'Blocked',
                    value    : true
                }],
                listeners : {
                    load : function(store, data, success) {
                        callback(store.totalCount);
                    }
                }
            });
        },

        getUnEstimatedCount: function(callback) { //Non Initial Version / Accepted
            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad : true,
                pageSize : 1,
                fetch    : ['PlanEstimate','Iteration','ScheduleState'],
                hydrate  : ['ScheduleState'],
                filters  : [{
                    property : '__At',
                    value    : 'current'
                },{
                    property : '_TypeHierarchy',
                    value    : 'HierarchicalRequirement'
                },{
                    property : '_ItemHierarchy',
                    operator : 'in',
                    value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
                },{
                    property : 'Children',
                    value    : null
                },{
                    property : 'PlanEstimate',
                    value    : 0
                },{
                    property : 'ScheduleState',
                    operator : '!=',
                    value    : 'Initial Version'
                },{
                    property : 'ScheduleState',
                    operator : '!=',
                    value    : 'Accepted'
                }],
                listeners : {
                    load : function(store, data, success) {
                        callback(store.totalCount);
                    }
                }
            });
        }
    },

    viewport: {
        update: function() {
            Ext.getBody().mask('Loading');
            var info = App.down('#rpmTree').getSelectionModel().getSelection()[0].raw;
            App.projectStats.getBlockedStoryCount(function(blockedCount) {
                App.projectStats.getUnEstimatedCount(function(unEstimatedCount) {
                    App.down('#settings').setHeight(160);
                    App.down('#rpm_level_info').update({
                        html: '<div class="info_title">Planned Start Date:</div>'       + ((info.pStart) ? info.pStart.substring(0,10) : 'N/A') + '<br /> \
                               <div class="info_title">Planned End Date:</div>'         + ((info.pEnd)   ? info.pEnd.substring(0,10)   : 'N/A') + '<br /> \
                               <div class="info_title">Blocked User Stories:</div>'     + Ext.util.Format.number(blockedCount, '0,0')           + '<br /> \
                               <div class="info_title">Unestimated User Stories:</div>' + Ext.util.Format.number(unEstimatedCount, '0,0')       + '<br /> \
                               <div class="info_title">Acceptance Rate:</div>'          + Ext.util.Format.number(parseFloat((info.acpCnt / info.usCnt) * 100), '0.0') + '% (' + Ext.util.Format.number(info.acpCnt, '0,0') + ' / ' + Ext.util.Format.number(info.usCnt, '0,0') + ')<br />'
                    });     
                });
            });
            //Load historical data from selected RPM level
            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad : true,
                pageSize : 1000000,
                fetch    : ['AcceptedLeafStoryPlanEstimateTotal','LeafStoryPlanEstimateTotal'],
                filters  : [{
                    property : 'ObjectID',
                    value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
                }],
                listeners : {
                    load : function(store, data, success) {
                        App.viewport.lbData = [];
                        Ext.Array.each(data, function(i) {
                            App.viewport.lbData.push(i.raw);
                        });
                        App.datePickerListen = false;
                        App.down('#min_date').setValue(Ext.Date.clearTime((App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.pStart) ? Rally.util.DateTime.fromIsoString(App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.pStart) : Ext.Date.add(new Date(), Ext.Date.DAY, -30)));
                        App.down('#max_date').setValue(Ext.Date.clearTime((App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.pEnd && App.down('#showFuture').getValue() === true) ? Rally.util.DateTime.fromIsoString(App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.pEnd) : new Date()));
                        App.datePickerListen = true;
                        App.viewport.populateGrid();
                    }
                }
            });
        },

        populateGrid: function() {
            var aDate = App.down('#min_date').getValue();
            var bDate = App.down('#max_date').getValue();
            //Align dates with begining of week (Sunday)
            while (aDate.getDay() !== 0) {
                aDate = Ext.Date.add(aDate, Ext.Date.DAY, -1);
            }
            while (bDate.getDay() !== 0) {
                bDate = Ext.Date.add(bDate, Ext.Date.DAY, -1);
            }

            var remaining          = 0;
            var qDates             = [];
            App.viewport.chartData = [];
            while (aDate <= bDate) {
                remaining++;
                qDates.push(Rally.util.DateTime.toIsoString(aDate));
                aDate = Ext.Date.add(aDate, Ext.Date.DAY, 7);
            }
            for (d in qDates) {
                getScopeOn(qDates[d], function() {
                    if (!--remaining) {
                        if (App.down('#showFuture').getValue() === true) {
                            var onFutureIterOIDs = setInterval(function() {
                                if (App.iterations.loaded) {
                                    clearInterval(onFutureIterOIDs);
                                    App.viewport.getPlannedScope();
                                }
                            }, 250);
                        } else {
                            App.viewport.drawChart();
                        }
                    }
                });
            }

            function getScopeOn(date, callback) {
                if (App.viewport.lbData.length > 0 && App.viewport.lbData[0]._ValidFrom <= date) {
                    Ext.Array.each(App.viewport.lbData, function(n) {
                        if (n._ValidFrom <= date && n._ValidTo >= date) {
                            App.viewport.chartData.push({
                                Date     : date,
                                Total    : n.LeafStoryPlanEstimateTotal,
                                Accepted : n.AcceptedLeafStoryPlanEstimateTotal,
                                Planned  : 0,
                                Color    : '#5C9ACB'
                            });
                            callback(0);
                        } 
                    });
                } else {
                    callback(-1);
                }
            }
        },

        getPlannedScope: function() {
            App.viewport.plannedOffChart = false;
            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad : true,
                pageSize : 1000000,
                fetch    : ['PlanEstimate','Iteration'],
                filters  : [{
                    property : '__At',
                    value    : 'current'
                },{
                    property : '_TypeHierarchy',
                    value    : 'HierarchicalRequirement'
                },{
                    property : '_ItemHierarchy',
                    operator : 'in',
                    value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
                },{
                    property : 'Iteration',
                    operator : '!=',
                    value    : null
                },{
                    property : 'PlanEstimate',
                    operator : '>',
                    value    : 0
                },{
                    property : 'Children',
                    value    : null
                }],
                listeners : {
                    load : function(store, data, success) {
                        Ext.Array.each(data, function(i) {
                            if (App.iterations.dateHash[i.raw.Iteration] !== undefined) {
                                Ext.Array.each(App.viewport.chartData, function(j) {
                                    if (App.viewport.plannedOffChart === false && App.iterations.dateHash[i.raw.Iteration] > Rally.util.DateTime.toIsoString(App.down('#max_date').getValue())) {
                                        App.viewport.plannedOffChart = true;
                                    }
                                    if (j.Date >= App.iterations.dateHash[i.raw.Iteration]) {
                                        j.Planned += i.raw.PlanEstimate;
                                    }
                                });
                            }
                        });
                        App.viewport.drawChart();
                    }
                }
            });
        },

        drawChart: function() {
            App.viewport.chartData.sort(function(a, b) {
                return a['Date'] > b['Date'] ? 1 : a['Date'] < b['Date'] ? -1 : 0;
            });
            var now = Rally.util.DateTime.toIsoString(new Date());
            Ext.Array.each(App.viewport.chartData, function(i) {
                if (i.Date > now) {
                    i.Planned += i.Accepted;
                    i.Accepted = 0;
                    i.Color = '#71CD5B';
                }
            });
            if (App.viewport.plannedOffChart == false) {
                for (var i = App.viewport.chartData.length - 1; i > 2; i--) {
                    if (App.viewport.chartData[i].Planned === App.viewport.chartData[i - 3].Planned) //Assuming 3 week iterations
                        App.viewport.chartData[i].Planned = 0;
                    else
                        break;
                };
            }
            var series = [{
                type: 'column',
                axis: 'left',
                xField: 'Date',
                yField: 'Accepted',
                renderer: function(sprite, record, attr, index, store) {
                    return Ext.apply(attr, {
                        fill: record.get('Color')
                    });
                },
                style: {
                    fill: '#5C9ACB'
                },
                tips: {
                    trackMouse: true,
                    width: 100,
                    height: 45,
                    renderer: function(storeItem, item) {
                        this.setTitle('<b>' + Ext.Date.format(Rally.util.DateTime.fromIsoString(storeItem.raw.Date), 'M j, Y') + '</b><br />' + Ext.util.Format.number(storeItem.get('Accepted'), '0,000') + ' Points');
                    }
                }
            }];
            if (App.down('#showFuture').getValue() === true) series.push({
                type: 'column',
                axis: 'left',
                xField: 'Date',
                yField: 'Planned',
                renderer: function(sprite, record, attr, index, store) {
                    return Ext.apply(attr, {
                        fill: record.get('Color')
                    });
                },
                style: {
                    fill: '#71CD5B'
                },
                tips: {
                    trackMouse: true,
                    width: 100,
                    height: 45,
                    renderer: function(storeItem, item) {
                        this.setTitle('<b>' + Ext.Date.format(Rally.util.DateTime.fromIsoString(storeItem.raw.Date), 'M j, Y') + '</b><br />' + Ext.util.Format.number(storeItem.get('Planned'), '0,000') + ' Points');
                    }
                }
            });
            series.push({
                type: 'line',
                axis: 'left',
                xField: 'Date',
                yField: 'Total',
                markerConfig: {
                    type: 'circle',
                    size: 3,
                    stroke: '#000',
                    fill: '#FFF'
                },
                style: {
                    stroke: '#000',
                    'stroke-width': 2,
                },
                tips: {
                    trackMouse: true,
                    width: 100,
                    height: 45,
                    renderer: function(storeItem, item) {
                        this.setTitle('<b>' + Ext.Date.format(Rally.util.DateTime.fromIsoString(storeItem.raw.Date), 'M j, Y') + '</b><br />' + Ext.util.Format.number(storeItem.get('Total'), '0,000') + ' Points');
                    }
                }
            });

            Ext.getBody().unmask();
            App.down('#viewport').removeAll();
            App.down('#viewport').add({
                xtype  : 'container',
                layout : 'fit',
                height : 20,
                html   : '<div class="chart_title">"' + App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.name + '" Burn-Up</div>'
            });
            App.down('#viewport').add({
                xtype   : 'chart',
                id      : 'chart',
                width   : Ext.get('viewport').getWidth()  - 25,
                height  : Ext.get('viewport').getHeight() - 40,
                margin  : '10 0 0 10',
                animate : true,
                legend  : { position: 'right' },
                store   : Ext.create('Ext.data.JsonStore', {
                    fields : ['Date','Accepted','Planned','Color','Total'],
                    data   : App.viewport.chartData
                }),
                axes: [{
                    type: 'Numeric',
                    position: 'left',
                    fields: ['Accepted','Planned','Total'],
                    title: 'Plan Estimate',
                    grid: true
                },{
                    type     : 'Category',
                    position : 'bottom',
                    fields   : ['Date'],
                    title    : 'Date',
                    label   : {
                        rotate:{degrees:315},
                        renderer: function(d){
                            return d.substring(0,10);
                        }
                    }
                }],
                series: series
            });

        }  
    }
});