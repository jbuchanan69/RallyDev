// RPM Burnup v0.6.1
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
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        },
        items: [{
            id     : 'projectTreePopout', 
            layout : 'fit',
            border : 0,
            flex   : 1,
            style  : {
                borderBottom : '1px solid #99BCE8'
            }
        },{
            id      : 'settings',
            height  : 22,
            border  : 0,
            margins : 4,
            items: [{
                xtype       : 'container',
                id          : 'rpm_level_info'
            },{
                xtype       : 'checkbox',
                id          : 'showFuture',
                fieldLabel  : 'Future Iterations:',
                width       : 285,
                labelWidth  : 150,
                labelAlign  : 'right',
                checked     : true,
                listeners   : {
                    change  : function() {
                        Ext.onReady(function() {
                            if (App.down('#projectTree').getSelectionModel().getSelection().length > 0) App.viewport.update();
                        });
                    }
                }
            },{
                xtype      : 'container',
                id         : 'date_fields'
            }]
        }]
    },{
        id     : 'viewport',
        region : 'center'
    }],


	launch: function() {
        App = this;
		App.rpmTree.init();
        App.dateOverride = false;
        App.down('#viewport').addListener('resize', function() {
            if (App.down('#chart')) {
                App.down('#chart').setWidth(Ext.get('viewport').getWidth() - 40);
                App.down('#chart').setHeight(Ext.get('viewport').getHeight() - 40);
            }
            if (App.popup) {
                App.popup.setWidth(Ext.getBody().getWidth());
                App.popup.setHeight(Ext.getBody().getHeight());
            }
        });
	},

	rpmTree: {
        init: function() {
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad: true,
                model: 'PortfolioItem/Initiative',
                fetch: ['ActualStartDate','ActualEndDate','Children','AcceptedLeafStoryCount','LeafStoryCount','Name','ObjectID','PlannedStartDate','PlannedEndDate','UnEstimatedLeafStoryCount'],
                listeners: {
                    load: function(store, data) {
                        if (data.length == 0) {
                            Ext.Msg.alert('Error', '<div class="error">This app must be ran within a context which features Initiative Portfolio Items.<br />Please change your project scope and try again.</div>');
                            return;
                        } else {
                            var roots = [];
                            Ext.Array.each(data, function(i) {
                                roots.push({
                                    name     : i.raw.Name,
                                    text     : '<span class="count">' + i.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + i.raw.Name + '</span>',
                                    id       : i.raw.ObjectID,
                                    leaf     : i.raw.Children == undefined || i.raw.Children.length == 0,
                                    start    : i.raw.PlannedStartDate,
                                    end      : i.raw.PlannedEndDate,
                                    actStart : i.raw.ActualStartDate,
                                    actEnd   : i.raw.ActualEndDate,
                                    acptStr  : ((i.raw.AcceptedLeafStoryCount == 0 || i.raw.LeafStoryCount == 0) ? '0' : Math.round((i.raw.AcceptedLeafStoryCount / i.raw.LeafStoryCount) * 100)) + '% (' + i.raw.AcceptedLeafStoryCount + ' / ' + i.raw.LeafStoryCount + ')',
                                    unEstCt  : i.raw.UnEstimatedLeafStoryCount
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
											    name     : c.raw.Name,
                                                text     : '<span class="count">' + c.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + c.raw.Name + '</span>',
                                                id       : c.raw.ObjectID,
                                                leaf     : c.raw.Children == undefined || c.raw.Children.length == 0,
                                                start    : c.raw.PlannedStartDate,
                                                end      : c.raw.PlannedEndDate,
                                                actStart : c.raw.ActualStartDate,
                                                actEnd   : c.raw.ActualEndDate,
                                                acptStr  : ((c.raw.AcceptedLeafStoryCount == 0 || c.raw.LeafStoryCount == 0) ? '0' : Math.round((c.raw.AcceptedLeafStoryCount / c.raw.LeafStoryCount) * 100)) + '% (' + c.raw.AcceptedLeafStoryCount + ' / ' + c.raw.LeafStoryCount + ')',
                                                unEstCt  : c.raw.UnEstimatedLeafStoryCount
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
                                    fetch: ['ActualStartDate','ActualEndDate','Children','AcceptedLeafStoryCount','LeafStoryCount','Name','ObjectID','PlannedStartDate','PlannedEndDate','UnEstimatedLeafStoryCount'],
                                    listeners: {
                                        load: function(store, data) {
                                            callback(data);
                                        }
                                    }
                                });
                            }
                        },
                        selectionchange: function() {
                            App.dateOverride = false;
                            App.viewport.update();
                        }
                    }
                });
            }
        }
    },

    viewport: {
    	update: function() {
            Ext.getBody().mask('Loading: 0%');
            //Display project info in panel
            var info = App.down('#projectTree').getSelectionModel().getSelection()[0].raw;
            App.down('#settings').setHeight(160);
            App.down('#rpm_level_info').update({
                html: '<div class="info_title">Planned Start Date:</div>'        + ((info.start) ? info.start.substring(0,10) : 'N/A')       + '<br /> \
                       <div class="info_title">Planned End Date:</div>'          + ((info.end) ? info.end.substring(0,10) : 'N/A')           + '<br /> \
                       <div class="info_title">Actual Start Date:</div>'         + ((info.actStart) ? info.actStart.substring(0,10) : 'N/A') + '<br /> \
                       <div class="info_title">Actual End Date:</div>'           + ((info.actEnd) ? info.actEnd.substring(0,10) : 'N/A')     + '<br /> \
                       <div class="info_title">Unestimated User Stories: </div>' + Ext.util.Format.number(info.unEstCt, '0,000')             + '<br /> \
                       <div class="info_title">Acceptance Rate:</div>'           + info.acptStr
                       
                       
            });
            //Set date range for querying
            var qDates = [],
                xStart = null,
                xEnd   = null;
            if (App.dateOverride) {
                xStart = App.down('#min_date').getValue();
                xEnd   = App.down('#max_date').getValue();
            } else {
                xStart = App.down('#projectTree').getSelectionModel().getSelection()[0].raw.start,
                xEnd   = App.down('#projectTree').getSelectionModel().getSelection()[0].raw.end;
                if (!xStart || !xEnd) {
                    xStart = Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(), Ext.Date.DAY, -30));
                    xEnd   = Rally.util.DateTime.toIsoString(new Date());
                }
                xStart = Rally.util.DateTime.fromIsoString(xStart);
                xEnd   = Rally.util.DateTime.fromIsoString(xEnd);
                if (App.down('#showFuture').getValue() == false && xEnd > new Date()) xEnd = new Date(); // Don't worry about the future
                //Add date pickers
                App.down('#date_fields').removeAll();
                App.down('#date_fields').add({
                    xtype      : 'datefield',
                    id         : 'min_date',
                    width      : 285,
                    showToday  : false,
                    fieldLabel : 'Chart Start Date:',
                    labelWidth : 150,
                    labelAlign : 'right',
                    value      : xStart,
                    listeners  : {
                        change : function() {
                            App.dateOverride = true;
                            App.viewport.update();
                        }
                    }
                });
                App.down('#date_fields').add({
                    xtype      : 'datefield',
                    id         : 'max_date',
                    width      : 285,
                    showToday  : false,
                    fieldLabel : 'Chart End Date:',
                    labelWidth : 150,
                    labelAlign : 'right',
                    value      : xEnd,
                    listeners  : {
                        change : function() {
                            App.dateOverride = true;
                            App.viewport.update();
                        }
                    }
                });
            }
            
            //Fill array for query dates and call queries on each date
            var queryDelta = parseInt((xEnd.getTime() - xStart.getTime()) / 50);
            if (queryDelta < 86400000) queryDelta = 86400000; //One day
            while (xStart <= xEnd) {
                qDates.push(Rally.util.DateTime.toIsoString(xStart));
                xStart = Ext.Date.add(xStart, Ext.Date.MILLI, queryDelta);
            }
            if (xStart != xEnd) qDates.push(Rally.util.DateTime.toIsoString(xEnd));
            var remaining = qDates.length;
            if (remaining == 0) {
                drawChart();
            } else {
                var initial = remaining;
                Ext.Array.each(qDates, function(d, k) {
                    getPointsOn(d, function(totalPoints, acceptedPoints, storyData) {
                        qDates[k] = {
                            date     : d.substring(0,10),
                            dateStr  : d,
                            Total    : totalPoints,
                            Accepted : acceptedPoints,
                            Stories  : storyData,
                            Color    : 'rgb(92,154,203)'
                        };
                        Ext.getBody().mask('Loading: ' + parseInt((1 - (remaining / initial)) * 100) + '%');
                        if (!--remaining) (App.down('#showFuture').getValue()) ? getFutureTotals() : drawChart();
                    });
                });
            }
            
            function getFutureTotals() {
                xStart = Rally.util.DateTime.toIsoString(new Date());
                xEnd   = Rally.util.DateTime.toIsoString(App.down('#max_date').getValue());
                
                if (xStart > xEnd || qDates[qDates.length - 1].Stories.length == 0) {
                    drawChart();
                    return;
                } //No future iterations in project range

                var iterOIDs   = [];
                var iterFilter = [];
                var iterHash   = {};
                var iterPoints = {};
                var remaining  = 0;
                Ext.Array.each(qDates[qDates.length - 1].Stories, function(s, k) {
                    if (s.Iteration && Ext.Array.indexOf(iterOIDs, s.Iteration) == -1) {
                        iterOIDs.push(s.Iteration);
                        iterFilter.push({
                            property : 'ObjectID',
                            value    : s.Iteration
                        });
                    }
                    if (iterFilter.length == 75 || k == qDates[qDates.length - 1].Stories.length - 1) {
                        getIters();
                        iterFilter = [];
                        remaining++;
                    }
                });
                
                function getIters() {
                    Ext.create('Rally.data.WsapiDataStore', {
                        autoLoad : true,
                        model    : 'Iteration',
                        fetch    : ['Name','ObjectID','StartDate'],
                        filters  : Rally.data.QueryFilter.and([
                            { property: 'EndDate', operator: '>=', value: xStart },
                            { property: 'EndDate', operator: '<=', value: xEnd   },
                            Rally.data.QueryFilter.or(iterFilter)
                        ]),
                        listeners: {
                            load : function(store, data) {
                                Ext.Array.each(data, function(i) {
                                    iterHash[i.raw.ObjectID] = {
                                        Name  : i.raw.Name,
                                        Start : i.raw.StartDate
                                    };
                                });
                                if (!--remaining) processIterPoints();
                            }
                        }
                    });
                }

                function processIterPoints() {
                    Ext.Array.each(qDates[qDates.length - 1].Stories, function(s) {
                        if (s.Iteration != undefined && iterHash[s.Iteration] != undefined) {
                            if (iterPoints[iterHash[s.Iteration].Name] == undefined)
                                iterPoints[iterHash[s.Iteration].Name] = {
                                    Points : 0,
                                    Start  : Rally.util.DateTime.toIsoString(new Date(iterHash[s.Iteration].Start))
                                };
                            iterPoints[iterHash[s.Iteration].Name].Points += parseInt(s.PlanEstimate);
                        }
                    });
                    Ext.Array.each(qDates, function(d) {
                        if (d.dateStr > Rally.util.DateTime.toIsoString(new Date())) { //Date is in the future
                            for (i in iterPoints) {
                                if (d.dateStr > iterPoints[i].Start) { //Date is after start of the iteration
                                    d.Accepted += iterPoints[i].Points;
                                }
                            }
                            d.Planned  = d.Accepted;
                            d.Accepted = 0;
                            d.Color    = 'rgb(113,205,91)';
                        }
                    });
                    for (var d = qDates.length - 1; d > 0; d--) {
                        if (qDates[d].Planned == qDates[d-1].Planned) qDates[d].Planned = 0;
                        else break;
                    }
                    drawChart();
                }

            }

            function getPointsOn(date, callback) {
                Ext.create('Rally.data.lookback.SnapshotStore', {
                    autoLoad: true,
                    pageSize: 10000,
                    fetch: ['_UnformattedID','Name','PlanEstimate','ScheduleState','Iteration'],
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
                                acceptedPoints = 0,
                                storyData      = [];
                            Ext.Array.each(data, function(s) {
                                totalPoints += parseInt(s.raw.PlanEstimate);
                                if (s.raw.ScheduleState == 'Accepted') acceptedPoints += parseInt(s.raw.PlanEstimate);
                                storyData.push(s.raw);
                            });
                            callback(totalPoints, acceptedPoints, storyData);
                        }
                    }
                });
            }

            function drawChart() {
                for (var d = qDates.length - 1; d > 0; d--) {
                    if (qDates[d].dateStr > Rally.util.DateTime.toIsoString(new Date())) qDates[d].Accepted = 0;
                    else break;
                }
                Ext.getBody().unmask();
                App.down('#viewport').removeAll();
                App.down('#viewport').add({
                    xtype  : 'container',
                    layout : 'fit',
                    height : 20,
                    html   : '<div class="chart_title">"' + App.down('#projectTree').getSelectionModel().getSelection()[0].raw.name + '" Burn-Up</div>'
                });
                var popupListener = {
                    itemmousedown : function(obj) {
                        //When the user clicks a bar the current composition for that time should show up
                        App.popup = Ext.create('Rally.ui.dialog.Dialog', {
                            id         : 'popup',
                            width      : Ext.getBody().getWidth(),
                            height     : Ext.getBody().getHeight(),
                            autoScroll : true,
                            closable   : true,
                            title      : '"' + App.down('#projectTree').getSelectionModel().getSelection()[0].raw.name + '" User Story Composition (' + obj.storeItem.raw.date + ')',
                            autoShow   : true,
                            items: [{
                                xtype             : 'rallygrid',
                                layout            : 'fit',
                                showPagingToolbar : false,
                                disableSelection  : true,
                                store : Ext.create('Rally.data.custom.Store', {
                                    data     : obj.storeItem.raw.Stories,
                                    fields   : ['_UnformattedID','Name','PlanEstimate','ScheduleState'],
                                    sorters  : [{
                                        property  : '_UnformattedID',
                                        direction : 'ASC'
                                    }],
                                    pageSize : 1000
                                }),
                                columnCfgs : [{
                                    text      : 'ID',
                                    dataIndex : '_UnformattedID',
                                    width     : 60,
                                    renderer  : function(val) {
                                        return 'US' + val;
                                    }
                                },{
                                    text      : 'Name',
                                    dataIndex : 'Name',
                                    flex      : 1
                                },{
                                    text      : 'Plan Estimate',
                                    dataIndex : 'PlanEstimate',
                                    width     : 100,
                                    align     : 'center'
                                },{
                                    text      : 'State',
                                    dataIndex : 'ScheduleState',
                                    width     : 100,
                                    align     : 'center'
                                }]
                            }],
                            listeners: {
                                afterrender: function() {
                                    this.toFront();
                                    this.focus();
                                }
                            }
                        });
                    }
                };
                var series = [{
                    type: 'column',
                    axis: 'left',
                    xField: 'date',
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
                            this.setTitle('<b>' + Ext.Date.format(new Date(storeItem.raw.dateStr), 'M j, Y') + '</b><br />' + Ext.util.Format.number(storeItem.get('Accepted'), '0,000') + ' Points');
                        }
                    },
                    listeners: popupListener
                }];
                if (App.down('#showFuture').getValue()) series.push({
                    type: 'column',
                    axis: 'left',
                    xField: 'date',
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
                            this.setTitle('<b>' + Ext.Date.format(new Date(storeItem.raw.dateStr), 'M j, Y') + '</b><br />' + Ext.util.Format.number(storeItem.get('Planned'), '0,000') + ' Points');
                        }
                    },
                    listeners: popupListener
                });
                series.push({
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
                        width: 100,
                        height: 45,
                        renderer: function(storeItem, item) {
                            this.setTitle('<b>' + Ext.Date.format(new Date(storeItem.raw.dateStr), 'M j, Y') + '</b><br />' + Ext.util.Format.number(storeItem.get('Total'), '0,000') + ' Points');
                        }
                    },
                    listeners: popupListener
                });

                App.down('#viewport').add({
                    xtype   : 'chart',
                    id      : 'chart',
                    width   : Ext.get('viewport').getWidth()  - 40,
                    height  : Ext.get('viewport').getHeight() - 40,
                    margin  : '10 0 0 10',
                    animate : true,
                    legend  : { position: 'right' },
                    store   : Ext.create('Ext.data.JsonStore', {
                        fields : ['date','Accepted','Planned','Color','Total'],
                        data   : qDates
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
                        fields   : ['date'],
                        title    : 'Date',
                        label   : {
                            rotate:{degrees:315},
                            renderer: function(d){
                                return d.substring(5,10);
                            }
                        }
                    }],
                    series: series
                });
            }
    	}
    }
});