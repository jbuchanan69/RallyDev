// RPM Story Teller - Version 1.2.1
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
		split       : true
	},
	items: [{
		title       : 'Settings',
		id          : 'popout',
		region      : 'west',
		margins     : '5 0 0 0',
		layout: {
			type  : 'vbox',
			align : 'stretch',
			pack  : 'start',
		},
		items: [{
			id      : 'settingsPanel',
			layout  : 'fit',
			height  : 34,
			border  : 0,
			padding : 5,
			style   : {
				borderBottom  : '1px solid #99BCE8'
			},
			items       : [{
				xtype      : 'rallyiterationcombobox',
				id         : 'iterPicker',
				width      : 300,
				fieldLabel : 'Iteration:',
				labelWidth : 40,
				listeners  : {
					change : function() {
						Ext.onReady(function() {
							App.viewport.update();
						});
					}
				}
			}]
		},{
			id     : 'rpmTreeContainer', 
			layout : 'fit',
			border : 0,
			flex   : 1
		}]
	},{
		id          : 'viewport',
		collapsible : false,
		region      : 'center',
		margins     : '5 0 0 0'
	}],

	launch: function() {
		Ext.getBody().mask('Initializing UI...');
		App = this;
		App.usStore = {};
		App.rpmTree.init();
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
							App.down('#popout').setWidth(250);
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
		update: function() {
			var gridArray = [];
			App.down('#viewport').removeAll();
			if (App.down('#rpmTree').getSelectionModel().getSelection().length == 0) {
				return; //Nothing to render
			} else {
				Ext.getBody().mask('Loading...');
				loadDetails(function() {
					if (gridArray.length == 0) {
						Ext.getBody().unmask();
						Ext.Msg.alert('Error', 'The selected query criteria returned no results.');
						return;
					}
					//Render grid to page
					Ext.getBody().unmask();
					App.down('#viewport').add({
						xtype             : 'rallygrid',
						disableSelection  : true,
						showPagingToolbar : false,
						store: Ext.create('Rally.data.custom.Store', {
							data       : gridArray,
							groupField : 'Team',
							pageSize   : 1000,
							sorters    : [
								{ property: 'Team',         direction: 'ASC'  },
								{ property: 'State',        direction: 'ASC'  },
								{ property: 'PlanEstimate', direction: 'DESC' }
							]
						}),
						features: [Ext.create('Ext.grid.feature.Grouping', {
				        	groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
				   		})],
						columnCfgs: [{
							text      : 'ID',
							dataIndex : '_UnformattedID',
							width     : 60,
							renderer  : function(val, meta, record) {
								return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('ObjectID') + '">US' + val + '</a>';
							}
						},{
							text      : 'Name',
							dataIndex : 'Name',
							flex      : 1,
							minWidth  : 150
						},{
							text      : 'State',
							dataIndex : 'State',
							width     : 75,
							align     : 'center',
							renderer  : function(val) {
								return ['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'][val];
							}
						},{
							text      : 'Plan Estimate',
							dataIndex : 'PlanEstimate',
							width     : 75,
							align     : 'center'
						},{
							text      : 'Estimated Task Hours',
							dataIndex : 'TaskEstimateTotal',
							width     : 75,
							align     : 'center'
						},{
							text      : 'Actual Task Hours',
							dataIndex : 'TaskActualTotal',
							width     : 75,
							align     : 'center'
						},{
							text      : 'Remaining Task Hours',
							dataIndex : 'TaskRemainingTotal',
							width     : 75,
							align     : 'center'
						}]
					});
				});
			}

			function loadDetails(callback) {
				var iterOIDs = [];
				var iterProjectHash = {};
				var loader = Ext.create('Rally.data.WsapiDataStore', {
					model: 'Iteration',
					filters: [{
						property: 'Name',
						value: App.down('#iterPicker').getRawValue()
					}],
					fetch: ['ObjectID','Project'],
					listeners: {
						load: function(store, data) {
							if (data && data.length) {
								Ext.Array.each(data, function(i) {
									iterOIDs.push(i.raw.ObjectID);
									iterProjectHash[i.raw.ObjectID] = i.raw.Project._refObjectName;
								});
								loader.nextPage();
							} else {
								Ext.create('Rally.data.lookback.SnapshotStore', {
									autoLoad: true,
									pageSize: 10000,
									filters: [{
										property : '_TypeHierarchy',
										value    : 'HierarchicalRequirement'
									},{
										property : '__At',
										value    : 'current'
									},{
										property : '_ItemHierarchy',
										value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].data.id
									},{
										property : 'Children',
										value     : null
									},{
										property : 'Iteration',
										operator : 'in',
										value    : iterOIDs
									}],
									fetch: [
										'_UnformattedID',
										'Iteration',
										'Name',
										'ObjectID',
										'Owner',
										'PlanEstimate',
										'ScheduleState',
										'TaskActualTotal',
										'TaskEstimateTotal',
										'TaskRemainingTotal'
									],
									hydrate: ['ScheduleState'],
									listeners: {
										load: function(store, data) {
											Ext.Array.each(data, function(s) {
												s.raw.Team = iterProjectHash[s.raw.Iteration];
												s.raw.State = Ext.Array.indexOf(['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'], s.raw.ScheduleState);
												gridArray.push(s.raw);
											});
											callback();
										}
									}
								});
							}
						}
					}
				});
				loader.loadPage(1);
			}
		}
	}
});