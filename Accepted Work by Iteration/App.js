// Accepted Work by Iteration Report - Version 0.3.0
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [{
		xtype  : 'container',
		layout : 'hbox',
		id     : 'toolbar',
		items  : [{
			xtype      : 'rallyiterationcombobox',
			id         : 'min_iter',
			width      : 265,
			fieldLabel : 'Iteration Range:',
			labelWidth : 75,
			listeners  : {
				ready  : function() {
					var me = this;
					Ext.onReady(function() {
						var items = App.down('#min_iter').store.data.items;
						for (i in items) {
				    		if (me.getValue() == items[i].data._ref) {
				    			(i < items.length - 4) ? me.setValue(items[parseInt(i) + 4].data._ref) : me.setValue(items[parseInt(items.length - 1)]);
				    			App.minIterLoaded = true;
				    			return;
				    		}
				    	}
					});
				}
			}
    	},{
			xtype      : 'rallyiterationcombobox',
			id         : 'max_iter',
			fieldLabel : 'to',
			labelWidth : 10,
			listeners  : {
				ready  : function() {
					Ext.onReady(function() {
						App.maxIterLoaded = true;
					});
				}
			}
    	}]
    },{
    	xtype  : 'container',
    	id     : 'chartContainer'
    },{
		xtype  : 'container',
		id     : 'viewport'
    }],

    launch: function() {
		App = this;
		var uiInitWait = setInterval(function() {
			if (App.minIterLoaded && App.maxIterLoaded) {
				clearInterval(uiInitWait);
				App.down('#min_iter').addListener('change', App.viewport.update);
				App.down('#max_iter').addListener('change', App.viewport.update);
				App.down('#chartContainer').addListener('resize', function() {
		            if (App.down('#chart')) {
		                App.down('#chart').setWidth(Ext.get('viewport').getWidth() - 25);
		            }
		        });
				App.viewport.update();
			}
		}, 500);
    },

    viewport: {
    	update: function() {
    		Ext.getBody().mask('Loading');
    		App.viewport.getIterations(function() {
    			var remaining = 0;
    			for (i in App.viewport.iterHash) {
    				remaining++;
    				App.viewport.getIterScope(
    					App.viewport.iterHash[i].OIDs,
    					App.viewport.iterHash[i].Start,
    					App.viewport.iterHash[i].End,
    					App.viewport.iterHash[i].Name,
    					function() {
    						if (!--remaining) App.viewport.doStats();
    					}
    				);
    			}
    		});
    	},

    	getIterations: function(callback) {
    		App.viewport.iterHash  = {};
    		App.viewport.teamHash  = {};
    		App.viewport.chartData = {};
	    	var loader = Ext.create('Rally.data.WsapiDataStore', {
	    		model     : 'Iteration',
	    		fetch     : ['Name','Project','ObjectID','StartDate','EndDate'],
	    		filters   : [{
					property : 'Project.Notes',
					operator : 'contains',
					value    : '*OFFICIAL AGILE TEAM*'
				},{
					property : 'StartDate',
					operator : '>=',
					value    : Rally.util.DateTime.toIsoString(App.down('#min_iter').getRecord().get('StartDate'))
				},{
					property : 'StartDate',
					operator : '<=',
					value    : Rally.util.DateTime.toIsoString(App.down('#max_iter').getRecord().get('StartDate'))
				}],
	    		listeners : {
	    			load : function(store, data) {
	    				if (data && data.length) {
	    					Ext.Array.each(data, function(i) {
	    						if (inPicker(i.raw.Name)) {
	    							if (App.viewport.iterHash[i.raw.Name] === undefined) {
		    							App.viewport.iterHash[i.raw.Name] = {
											Name  : i.raw.Name,
											Start : Rally.util.DateTime.toIsoString(Ext.Date.add(Rally.util.DateTime.fromIsoString(i.raw.StartDate), Ext.Date.DAY, 2)),
											End   : Rally.util.DateTime.toIsoString(Rally.util.DateTime.fromIsoString(i.raw.EndDate)),
											OIDs  : []
		    							};
		    						}
		    						App.viewport.iterHash[i.raw.Name].OIDs.push(i.raw.ObjectID);
		    						App.viewport.teamHash[i.raw.Project.ObjectID] = i.raw.Project.Name;
	    						}
	    					});
	    					loader.nextPage();
	    				} else {
	    					callback();
	    				}
	    			}
	    		}
	    	});
	    	loader.loadPage(1);

	    	function inPicker(iterName) {
	    		for (i in App.down('#min_iter').store.data.items) {
	    			if (App.down('#min_iter').store.data.items[i].raw.Name == iterName) return true;
	    		}
	    		return false;
	    	}

	    },

	    getIterScope: function(OIDs, start, end, iterName, callback) {
			getScopeOn(start, '_initial', function() {
				getScopeOn(end, '_final', callback);
			});

	    	function getScopeOn(date, scope, callback) {
	    		var filters = [{
    				property : '__At',
    				value    : date
    			},{
    				property : '_TypeHierarchy',
    				value    : 'HierarchicalRequirement'
    			},{
    				property : 'PlanEstimate',
    				operator : '>',
    				value    : 0
    			},{
    				property : 'Iteration',
    				operator : 'in',
    				value    : OIDs
    			}];

    			if (scope === '_final') filters.push({
    				property : 'ScheduleState',
    				value    : 'Accepted'
    			});

	    		Ext.create('Rally.data.lookback.SnapshotStore', {
	    			autoLoad : true,
	    			pageSize : 1000000,
	    			fetch    : ['PlanEstimate','Project'],
	    			filters  : filters,
	    			listeners : {
	    				load : function(store, data, success) {
	    					Ext.Array.each(data, function(i) {
	    						if (App.viewport.chartData[i.raw.Project] === undefined)
	    							App.viewport.chartData[i.raw.Project] = {
	    								TeamName : App.viewport.teamHash[i.raw.Project]
	    							};
	    						if (App.viewport.chartData[i.raw.Project][iterName + scope] === undefined)
	    							App.viewport.chartData[i.raw.Project][iterName + scope] = 0;
	    						App.viewport.chartData[i.raw.Project][iterName + scope] += i.raw.PlanEstimate;
	    					});
	    					callback();
	    				}
	    			}
	    		});
	    	}
	    },

	    doStats: function() {
			App.viewport.chartArray = [];
			App.viewport.fields     = ['TeamName'];
			App.viewport.columns    = [{
				text      : 'Team',
				dataIndex : 'TeamName',
				flex      : 1,
				summaryRenderer : function(val) {
					return '<b>Average:</b>';
				}
			}];
	    	for (i in App.viewport.chartData) {
	    		for (x in App.viewport.iterHash) {
	    			if (App.viewport.chartData[i][App.viewport.iterHash[x].Name + '_initial'] !== undefined &&
	    				App.viewport.chartData[i][App.viewport.iterHash[x].Name + '_final']   !== undefined) {
	    				App.viewport.chartData[i][App.viewport.iterHash[x].Name + '_rate']    = parseFloat(App.viewport.chartData[i][App.viewport.iterHash[x].Name + '_final'] / App.viewport.chartData[i][App.viewport.iterHash[x].Name + '_initial']);
	    			} else {
	    				App.viewport.chartData[i][App.viewport.iterHash[x].Name + '_rate']    = null;
	    			}
	    		}
	    		App.viewport.chartArray.push(App.viewport.chartData[i]);
	    	}
	    	for (i in App.viewport.iterHash) {
	    		App.viewport.fields.push(App.viewport.iterHash[i].Name + '_initial');
	    		App.viewport.fields.push(App.viewport.iterHash[i].Name + '_final');
	    		App.viewport.fields.push(App.viewport.iterHash[i].Name + '_rate');
	    		App.viewport.columns.push({
					text      : App.viewport.iterHash[i].Name,
					dataIndex : App.viewport.iterHash[i].Name + '_rate',
					width     : 100,
					resizable : false,
					align     : 'center',
					renderer  : function(val, meta, record, row, col) {
						if (typeof val === 'number' && !isNaN(val)) {
							(val >= .9) ? meta.tdCls = 'green' : (val >= .75) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
							return '<div class="percent" title="' + record.get(App.viewport.columns[col].text + '_final') + ' of ' + record.get(App.viewport.columns[col].text + '_initial') + ' Points">' + parseInt(val * 100) + '%</div>';
							//return '<div class="left half">' + parseInt(val * 100) + '%</div><div class="right half">' + record.get(App.viewport.columns[col].text + '_final') + ' of ' + record.get(App.viewport.columns[col].text + '_initial') + '</div>';
						} else {
							meta.tdCls = 'grey';
							return 'N/A';
						}
					},
					summaryType : 'average',
					summaryRenderer : function(val) {
						return '<div class="x-grid-cell ' + ((val >= .9) ? 'green' : (val >= .75) ? 'yellow' : 'red') + '" style="margin-left:-6px;width:100px;"><div class="x-grid-cell-inner"><div class="percent" style="margin:3px 2px 0 0"><b>' + Ext.util.Format.number(val * 100, '0.0') + '%</b></div></div></div>';
					}
	    		});
	    	}
	    	App.viewport.drawChart();
	    },

	    drawChart: function() {
	    	Ext.getBody().unmask();
	    	App.down('#chartContainer').removeAll();
	    	App.down('#viewport').removeAll();
	    	App.down('#viewport').add({
				xtype : 'rallygrid',
				showPagingToolbar: false,
				features: [{
		            ftype: 'summary'
		        }],
				store : Ext.create('Rally.data.custom.Store', {
					data     : App.viewport.chartArray,
					fields   : App.viewport.fields,
					sorters  : [
						{ property: 'TeamName', direction: 'ASC' }
					],
					pageSize : 1000
				}),
				columnCfgs : App.viewport.columns,
				listeners  : {
					itemclick: function(view, record, item, index, evt) {
						var trend = [];
						var maxTrend = 0;
						for (i in App.viewport.iterHash) {
							if (record.raw[i + '_rate']) {
								trend.push({
									Iteration : i,
									Rate      : parseFloat(record.raw[i + '_rate'] * 100),
									Red       : 75,
									Yellow    : 15,
									Green     : 0
								});
								maxTrend = Math.max(parseFloat(record.raw[i + '_rate'] * 100), maxTrend);
							} else {
								trend.push({
									Iteration : i,
									Rate      : 0,
									Red       : 75,
									Yellow    : 15,
									Green     : 0
								});
							}
						}
						for (i in trend) {
							trend[i].Green = maxTrend - 40;
						}
						App.down('#chartContainer').removeAll();
						App.down('#chartContainer').add({
			                xtype  : 'container',
			                layout : 'fit',
			                height : 20,
			                html   : '<div class="chart_title">"' + record.raw['TeamName'] + '" Acceptance Trend</div>'
			            });
			            App.down('#chartContainer').add({
			                xtype   : 'chart',
			                id      : 'chart',
			                width   : Ext.get('viewport').getWidth() - 25,
			                height  : 250,
			                margin  : '10 5 20 5',
			                // animate : true,
			                store   : Ext.create('Ext.data.JsonStore', {
			                    data   : trend,
			                    fields : ['Iteration','Rate','Red','Yellow','Green']
			                }),
			                axes: [{
			                    type: 'Numeric',
			                    position: 'left',
			                    fields: ['Rate'],
			                    title: 'Acceptance Rate',
			                    label   : {
			                        renderer: function(d){
			                            return d + '%';
			                        }
			                    },
			                    grid: true
			                },{
			                    type     : 'Category',
			                    position : 'bottom',
			                    fields   : ['Iteration'],
			                    label   : {
			                        // rotate:{degrees:315},
			                        renderer: function(d){
			                            return d.substring(0,14);
			                        }
			                    }
			                }],
			                series: [{
							    type: 'line',
							    axis: 'left',
							    xField: 'Iteration',
							    yField: 'Rate',
							    markerConfig: {
							        type: 'circle',
							        size: 3,
							        radius : 3,
							        stroke: '#000',
							        fill : '#FFF'
							    },
							    style: {
							        stroke: '#000',
							        'stroke-width': 1.5
							    }
							},{
								type      : 'area',
								highlight : false,
								axis      : 'left',
								xField    : 'Iteration',
								yField    : ['Red','Yellow','Green'],
								style     : { opacity: 0.75 },
								renderer: function(sprite, record, attr, index, store) {
				                    return Ext.apply(attr, {
				                        fill: ['#e5b5ba','#ffeb9c','#afd3b6'][index]
				                    });
				                }
						    }]
			            });
						window.location.href = '#toolbar';
					}
				}
			});
	    }
    }
});