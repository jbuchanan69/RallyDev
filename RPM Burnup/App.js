// RPM Burnup v0.2
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

	layout:'border',
    defaults: {
		autoScroll : true,
		split      : true,
		margins    : '5 0 0 0'
    },
    items: [{
    	title   : 'Project',
        id      : 'leftPopout',
        region  : 'west',
        collapsible : true,
        width   : 300,
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
        id : 'viewport',
        region : 'center'
    }],


	launch: function() {
		App = this;
		App.rpmTree.init();
        App.down('#viewport').addListener('resize', function() {
            if (App.down('#chart')) {
                App.down('#chart').setWidth(Ext.get('viewport').getWidth() - 20);
                App.down('#chart').setHeight(Ext.get('viewport').getHeight() - 20);
            }
        });
	},

	rpmTree: {
        init: function() {
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad: true,
                model: 'PortfolioItem/Initiative',
                fetch: ['Children','LeafStoryCount','Name','ObjectID','PlannedStartDate','PlannedEndDate'],
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
									name  : i.raw.Name,
									text  : '<span class="count">' + i.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + i.raw.Name + '</span>',
									id    : i.raw.ObjectID,
									leaf  : i.raw.Children == undefined || i.raw.Children.length == 0,
									start : i.raw.PlannedStartDate,
									end   : i.raw.PlannedEndDate
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
					xtype       : 'treepanel',
					id          : 'projectTree',
					rootVisible : false,
					layout      : 'fit',
					margin      : '-1 0 0 0',
					border      : 0,
					store       : Ext.create('Ext.data.TreeStore', {
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
												name  : c.raw.Name,
												text  : '<span class="count">' + c.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + c.raw.Name + '</span>',
												id    : c.raw.ObjectID,
												leaf  : c.raw.Children == undefined || c.raw.Children.length == 0,
												start : c.raw.PlannedStartDate,
												end   : c.raw.PlannedEndDate
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
                                    fetch: ['Children','LeafStoryCount','Name','ObjectID','PlannedStartDate','PlannedEndDate'],
                                    listeners: {
                                        load: function(store, data) {
                                            callback(data);
                                        }
                                    }
                                });
                            }
                        },
                        selectionchange: App.viewport.update
                    }
                });
            }
        }
    },

    viewport: {
    	update: function() {
            Ext.getBody().mask('Loading: 0%');
    		var xStart = App.down('#projectTree').getSelectionModel().getSelection()[0].raw.start,
                xEnd   = App.down('#projectTree').getSelectionModel().getSelection()[0].raw.end;
            if (!xStart || !xEnd) {
                xStart = Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(), Ext.Date.DAY, -30));
                xEnd   = Rally.util.DateTime.toIsoString(new Date());
            }
            //Setup query dates
            var qDates = [];
            xStart = new Date(xStart);
            xEnd   = new Date(xEnd);
            if (xEnd > new Date()) xEnd = new Date(); // Don't worry about the future
            var queryDelta = Math.ceil(Math.abs((xStart.getTime() - xEnd.getTime())/(86400000))); // Days between start and end date
            queryDelta = Math.round(queryDelta / 50);
            if (queryDelta == 0) queryDelta = 1;
            while (xStart <= xEnd) {
                qDates.push(Rally.util.DateTime.toIsoString(xStart));
                xStart = Ext.Date.add(xStart, Ext.Date.DAY, queryDelta);
            }
            var remaining = qDates.length;
            if (remaining == 0) {
                drawChart();
            } else {
                var initial = remaining;
                Ext.Array.each(qDates, function(d, k) {
                    getPointsOn(d, function(totalPoints, acceptedPoints) {
                        qDates[k] = {
                            date     : d.substring(5,10).replace('-','/'),
                            Total    : totalPoints,
                            Accepted : acceptedPoints
                        };
                        Ext.getBody().mask('Loading: ' + parseInt((1 - (remaining / initial)) * 100) + '%');
                        if (!--remaining) drawChart();
                    });
                });
            }
                

            function getPointsOn(date, callback) {
                Ext.create('Rally.data.lookback.SnapshotStore', {
                    autoLoad: true,
                    pageSize: 10000,
                    fetch: ['PlanEstimate','ScheduleState'],
                    hydrate: ['ScheduleState'],
                    filters: [{
                        property : '__At',
                        value    : date
                    },{
                        property : '_TypeHierarchy',
                        value    : 'HierarchicalRequirement'
                    },{
                        property : '_ItemHierarchy',
                        value    : App.down('#projectTree').getSelectionModel().getSelection()[0].raw.id
                    },{
                        property : 'PlanEstimate',
                        operator : '>',
                        value    : 0
                    },{
                        property : 'Children',
                        value    : null
                    }],
                    listeners: {
                        load: function(store, data) {
                            var totalPoints    = 0,
                                acceptedPoints = 0;
                            Ext.Array.each(data, function(s) {
                                totalPoints += parseInt(s.raw.PlanEstimate);
                                if (s.raw.ScheduleState == 'Accepted') acceptedPoints += parseInt(s.raw.PlanEstimate);
                            });
                            callback(totalPoints, acceptedPoints);
                        }
                    }
                });
            }

            function drawChart() {
                Ext.getBody().unmask();
                App.down('#viewport').removeAll();
                App.down('#viewport').add({
                    xtype   : 'chart',
                    id      : 'chart',
                    width   : Ext.get('viewport').getWidth()  - 20,
                    height  : Ext.get('viewport').getHeight() - 20,
                    margin  : '10 0 0 10',
                    animate : true,
                    legend  : { position: 'right' },
                    store   : Ext.create('Ext.data.JsonStore', {
                        fields : ['date','Accepted','Total'],
                        data   : qDates
                    }),
                    axes: [{
                        type: 'Numeric',
                        position: 'left',
                        fields: ['Accepted','Total'],
                        title: 'Plan Estimate',
                        grid: true
                    },{
                        type     : 'Category',
                        position : 'bottom',
                        fields   : ['date'],
                        title    : 'Date'
                    }],
                    series: [{
                        type: 'column',
                        axis: 'left',
                        xField: 'date',
                        yField: 'Accepted',
                        renderer: function(sprite, record, attr, index, store) {
                            return Ext.apply(attr, {
                                fill: 'rgb(92,154,203)'
                            });
                        },
                        style: {
                            fill: '#5C9ACB'
                        },
                        tips: {
                            trackMouse: true,
                            width: 90,
                            height: 28,
                            renderer: function(storeItem, item) {
                                this.setTitle(Ext.util.Format.number(storeItem.get('Accepted'), '0,000') + ' Points');
                            }
                        }
                    },{
                        type: 'line',
                        axis: 'left',
                        xField: 'date',
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
                            width: 90,
                            height: 28,
                            renderer: function(storeItem, item) {
                                this.setTitle(Ext.util.Format.number(storeItem.get('Total'), '0,000') + ' Points');
                            }
                        }
                    }]
                });
            }
    	}
    }
});