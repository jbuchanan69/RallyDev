// Defect Summary Report - Version 0.2
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
		extend: 'Rally.app.App',
		componentCls: 'app',

	layout:'border',
	defaults: {
		collapsible : true,
		collapsed   : false,
		autoScroll  : true,
		split       : true,
		margins : '5 0 0 0'
	},
	items: [{
		title   : 'Project',
		region  : 'west',
		width   : 300,
		id      : 'rpmTreeContainer', 
		layout  : 'fit'
	},{
		xtype       : 'tabpanel',
		id          : 'viewport',
		collapsible : false,
		region      : 'center',
		margins     : '5 0 0 0',
		activeTab   : 0, // index or id
		items:[
			{ title: 'Open Defect Count by Severity'        },
			{ title: 'Open Defect Maximum Target Dates'     },
			{ title: 'Open Defect Trending (Critical/High)' }
		],
		listeners: {
			beforetabchange: function(panel, newTab, oldTab) {
				Ext.onReady(function() {
					oldTab.removeAll();
				});
			},
			tabchange : function() {
				Ext.onReady(function() {
					App.viewport.draw();
				});
			}
		}
	}],

	launch: function() {
		Ext.getBody().mask('Initializing UI...');
		App = this;
		App.rpmTree.init();
		App.down('#viewport').addListener('resize', function() {
			if (App.down('#chart')) {
				App.down('#chart').setHeight(Ext.get('viewport').getHeight() - 50);
			}
		});
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
						added    : function() {
							Ext.getBody().unmask();
						},
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

						},
						selectionchange: function() {
							App.viewport.update();
						}
					}
				});
				
			}
		}
	},

	viewport: {
		de_store : {},
		update   : function() {
			Ext.getBody().mask('Loading...');
			App.viewport.de_store = {};
			//Get all defects which descend from the selected RPM level
			Ext.create('Rally.data.lookback.SnapshotStore', {
				autoLoad: true,
				pageSize: 1000000,
				fetch: ['_UnformattedID','Name','TargetDate','Project','Severity','State'],
				hydrate: ['Severity','State'],
				filters: [{
					property : '__At',
					value    : 'current'
				},{
					property : '_TypeHierarchy',
					value    : 'Defect'
				},{
					property : '_ItemHierarchy',
					value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
				}],
				listeners : {
					load : function(store, data) {
						if (data.length == 0) {
							Ext.getBody().unmask();
							App.down('#viewport').getActiveTab().removeAll();
							Ext.Msg.alert('Error', 'There are no defects for the selected project.');
						} else {
							var openDefects = false;
							Ext.Array.each(data, function(d) {
								if (d.raw.State != 'Fixed' && d.raw.State != 'Closed') { //Open Defect
									openDefects = true;
									if (App.viewport.de_store[d.raw.Project] == undefined)
										App.viewport.de_store[d.raw.Project] = {
											TeamOID      : d.raw.Project,
											DefectCounts : {
												Critical : 0,
												High     : 0,
												Medium   : 0,
												Cosmetic : 0,
												None     : 0,
												Total    : 0
											},
											TargetDates  : {
												Critical : [],
												High     : [],
												Medium   : [],
												Cosmetic : [],
												None     : []
											},
											HistoricalCounts : []
										};
									App.viewport.de_store[d.raw.Project].DefectCounts.Total++;
									App.viewport.de_store[d.raw.Project].DefectCounts[d.raw.Severity]++;
									//Target Dates
									if (d.raw.TargetDate && d.raw.Severity)
										App.viewport.de_store[d.raw.Project].TargetDates[d.raw.Severity].push(d.raw.TargetDate);
								}
							});
							if (openDefects) {
								getTeamNames();
							} else {
								Ext.getBody().unmask();
								App.down('#viewport').getActiveTab().removeAll();
								Ext.Msg.alert('Error', 'There are no open defects for the selected project.');
							}
						}
						
					}
				}
			});

			function getTeamNames() {
				var filter = [];
				for (i in App.viewport.de_store) {
					filter.push({
						property : 'ObjectID',
						value    : i
					});
				}
				Ext.create('Rally.data.WsapiDataStore', {
					autoLoad: true,
					model: 'Project',
					fetch: ['Name','ObjectID'],
					filters: Rally.data.QueryFilter.or(filter),
					listeners : {
						load: function(store, data) {
							Ext.Array.each(data, function(p) {
								App.viewport.de_store[p.raw.ObjectID].TeamName = p.raw.Name;
							});
							getHistoricalCounts();
						}
					}
				});
			}

			function getHistoricalCounts() {
				//Set up query range
				var aDate  = Ext.Date.add(new Date(), Ext.Date.MONTH, -1),
					bDate  = new Date(),
					qDates = [];
				while (aDate <= bDate) {
					for (p in App.viewport.de_store) {
						App.viewport.de_store[p].HistoricalCounts.push({
							date  : Rally.util.DateTime.toIsoString(aDate),
							count : 0
						});
					}
					qDates.push(Rally.util.DateTime.toIsoString(aDate));
					aDate = Ext.Date.add(aDate, Ext.Date.DAY, 1);
				}
				//Query to the LBAPI for each query date
				var remaining = qDates.length;
				Ext.Array.each(qDates, function(d, k) {
					getCountsOn(d, k);
				});

				function getCountsOn(date, idx) {
					Ext.create('Rally.data.lookback.SnapshotStore', {
						autoLoad: true,
						pageSize: 1000000,
						fetch: ['Project','State','Severity'],
						hydrate: ['State','Severity'],
						filters: [{
							property : '__At',
							value    : date
						},{
							property : '_TypeHierarchy',
							value    : 'Defect'
						},{
							property : '_ItemHierarchy',
							value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
						}],
						listeners : {
							load : function(store, data) {
								Ext.Array.each(data, function(d) {
									if ((d.raw.Severity == 'Critical' ||
										 d.raw.Severity == 'High')    &&
										 d.raw.State != 'Fixed'       &&
										 d.raw.State != 'Closed'      &&
										 App.viewport.de_store[d.raw.Project])
										App.viewport.de_store[d.raw.Project].HistoricalCounts[idx].count++;
								});
								if (!--remaining) App.viewport.draw();
							}
						}
					});
				}
			}
		},

		draw : function() {
			Ext.getBody().unmask();
			var gridArray  = [];
			var tab_number = App.down('#viewport').items.findIndex('id', App.down('#viewport').getActiveTab().id);
			var builders   = [
				function() {
					for (p in App.viewport.de_store) {
						gridArray.push({
							Team     : App.viewport.de_store[p].TeamName,
							Critical : App.viewport.de_store[p].DefectCounts.Critical,
							High     : App.viewport.de_store[p].DefectCounts.High,
							Medium   : App.viewport.de_store[p].DefectCounts.Medium,
							Cosmetic : App.viewport.de_store[p].DefectCounts.Cosmetic,
							None     : App.viewport.de_store[p].DefectCounts.None
						});
					}
					drawGrid([{
						text      : 'Team',
						dataIndex : 'Team',
						flex      : 1
					},{
						text      : 'Critical',
						dataIndex : 'Critical',
						width     : 100,
						align     : 'center'
					},{
						text      : 'High',
						dataIndex : 'High',
						width     : 100,
						align     : 'center'
					},{
						text      : 'Medium',
						dataIndex : 'Medium',
						width     : 100,
						align     : 'center'
					},{
						text      : 'Cosmetic',
						dataIndex : 'Cosmetic',
						width     : 100,
						align     : 'center'
					},{
						text      : 'None',
						dataIndex : 'None',
						width     : 100,
						align     : 'center'
					}]);
				},
				function() {
					for (p in App.viewport.de_store) {
						gridArray.push({
							Team               : App.viewport.de_store[p].TeamName,
							Critical_Max_Date  : Ext.Array.max(App.viewport.de_store[p].TargetDates.Critical),
							Critical_Max_Count : 0,
							High_Max_Date      : Ext.Array.max(App.viewport.de_store[p].TargetDates.High),
							High_Max_Count     : 0,
							Medium_Max_Date    : Ext.Array.max(App.viewport.de_store[p].TargetDates.Medium),
							Medium_Max_Count   : 0,
							Cosmetic_Max_Date  : Ext.Array.max(App.viewport.de_store[p].TargetDates.Cosmetic),
							Cosmetic_Max_Count : 0,
							None_Max_Date      : Ext.Array.max(App.viewport.de_store[p].TargetDates.None),
							None_Max_Count     : 0,
						});
						Ext.Array.each(['Critical','High','Medium','Cosmetic','None'], function(severity) {
							Ext.Array.each(App.viewport.de_store[p].TargetDates[severity], function(d) {
								if (d == gridArray[gridArray.length - 1][severity + '_Max_Date']) gridArray[gridArray.length - 1][severity + '_Max_Count']++;
							});
						});
					}
					var columns = [{
						text      : 'Team',
						dataIndex : 'Team',
						flex      : 1,
						minWidth  : 150
					}];
					Ext.Array.each(['Critical','High','Medium','Cosmetic','None'], function(severity) {
						columns.push({
							text      : severity,
							columns   : [{
								text      : 'Max Date',
								dataIndex : severity + '_Max_Date',
								width     : 90,
								align     : 'center',
								renderer  : function(val) { return (val) ? val.substring(0,10) : '' }
							},{
								text      : 'Count',
								dataIndex : severity + '_Max_Count',
								width     : 45,
								align     : 'center',
								renderer  : function(val) { return (val) ? val : '' }
							}]
						});
					});
					drawGrid(columns);
				},
				function() {
					var x_nodes = [],
						lines   = [],
						series;
					for (p in App.viewport.de_store) {
						if (x_nodes.length == 0) {
							Ext.Array.each(App.viewport.de_store[p].HistoricalCounts, function(i) {
								x_nodes.push(Ext.Date.format(Rally.util.DateTime.fromIsoString(i.date), 'n/j'));
							});
						}
						series = {
							name : App.viewport.de_store[p].TeamName,
							data : []
						};
						Ext.Array.each(App.viewport.de_store[p].HistoricalCounts, function(i) {
							series.data.push(i.count);
						});
						lines.push(series);
					}
					drawChart(x_nodes, lines);
				}
			];
			builders[tab_number]();

			function drawGrid(columns) {
				App.down('#viewport').getActiveTab().removeAll();
				App.down('#viewport').getActiveTab().add({
					xtype             : 'rallygrid',
					disableSelection  : true,
					showPagingToolbar : false,
					store             : Ext.create('Rally.data.custom.Store', {
						data     : gridArray,
						pageSize : 200,
						sorters  : [{
							property  : 'Team',
							direction : 'ASC'
						}]
					}),
					columnCfgs : columns
				});	
			}

			function drawChart(x_nodes, lines) {
				App.down('#viewport').getActiveTab().removeAll();
				App.down('#viewport').getActiveTab().add({
					xtype       : 'rallychart',
					id          : 'chart',
					height      : Ext.get('viewport').getHeight() - 50,
					chartConfig : {
						xAxis: [{
							categories  : x_nodes,
							title       : {
								text : 'Date'
							}
						}],
						yAxis : {
							min           : 0,
							allowDecimals : false,
							title         : {
								text : 'Defect Count'
							}
						},
						series : lines
					}
				});
			}

		}
	}
});