// RPM Work Item Composition - Version 1.0
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
			//Load RPM roots
			Ext.create('Rally.data.WsapiDataStore', {
				autoLoad : true,
				model    : 'portfolioitem/initiative',
				fetch    : [ 'Children', 'Name', 'ObjectID' ],
				listeners: {
					load: function(model, roots) {
						if (roots.length == 0) {
							App.removeAll();
							Ext.getBody().unmask();
							Ext.Msg.alert('Error', '<div class="error">This app must be ran within a context which features Initiative Portfolio Items.<br />Please change your project scope and try again.</div>');
							return;
						}
						//Create tree store using roots
						var nodes = [];
						var childFilter = [];
						Ext.Array.each(roots, function(root) {
							getDescendants(root.get('ObjectID'), function(descendants) {
								childFilter = [];
								Ext.Array.each(root.get('Children'), function(c) {
									childFilter.push({ property: 'ObjectID', value: c.ObjectID });
								});
								nodes.push({
									name        : root.get('Name'),
									childFilter : childFilter,
									text        : '<span class="count">' + descendants.length + '</span> - <span class="nodeTitle">' + root.get('Name') + '</span>',
									id          : root.get('ObjectID'),
									leaf        : root.raw.Children == undefined || root.raw.Children.length == 0,
									descendants : descendants
								});
								if (nodes.length == roots.length) {
									nodes.sort(function(a, b) { return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0; });
									drawTree();
								}
							});
						});

						function drawTree() {
							var newCount = 0;
							//Add tree to UI element
							App.down('#rpmTreeContainer').add({
								xtype        : 'treepanel',
								store        : Ext.create('Ext.data.TreeStore', { root: { expanded: true, children: nodes } }),
								id           : 'rpmTree',
								rootVisible  : false,
								margin       : '-1 0 0 0',
								border       : 0,
								listeners    : {
									beforeitemexpand: function(node) {
										if (node.hasChildNodes() == false && node.raw.childFilter.length > 0) { //Query for children of selected node
											var newNodes = [];
											var childLoader = Ext.create('Rally.data.WsapiDataStore', {
												model     : 'portfolioitem',
												fetch     : [ 'Children', 'Name', 'ObjectID' ],
												filters   : [ Rally.data.QueryFilter.or(node.raw.childFilter) ],
												listeners : {
													load  : function(model, children) {
														newCount = children.length;
														Ext.Array.each(children, function(child) {
															getDescendants(child.get('ObjectID'), function(descendants) {
																childFilter = [];
																Ext.Array.each(child.raw.Children, function(c) {
																	childFilter.push({ property: 'ObjectID', value: c.ObjectID });
																});
																newNodes.push({
																	name        : child.get('Name'),
																	childFilter : childFilter,
																	text        : '<span class="count">' + descendants.length + '</span> - <span class="nodeTitle">' + child.get('Name') + '</span>',
																	id          : child.get('ObjectID'),
																	leaf        : child.raw.Children == undefined || child.raw.Children.length == 0,
																	descendants : descendants
																});
															});
														});
													}
												}
											});
											childLoader.loadPages({
												callback: function() {
													var nodeWait = setInterval(function() {
														if (newNodes.length == newCount) {
															Ext.Array.each(newNodes.sort(function(a, b) {
																return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
															}), function(n) {
																node.appendChild(n);
															});
															clearInterval(nodeWait);
														}
													}, 50);
												}
											});
										}
									},
									selectionchange: function() {
										App.viewport.update();
									},
									added: function() {
										Ext.getBody().unmask();
									}
								}
							});
							App.down('#popout').setWidth(250);
						}
						
						function getDescendants(OID, callback) {
							Ext.create('Rally.data.lookback.SnapshotStore', {
								autoLoad: true,
								pageSize: 1000000,
								fetch: ['ObjectID'],
								filters: [
									{ property: '_ItemHierarchy', value: OID                       },
									{ property: 'Children',       value: null                      },
									{ property: '__At',           value: 'current'                 },
									{ property: '_TypeHierarchy', value: 'HierarchicalRequirement' }
								],
								listeners: {
									load: function(model, data, success) {
										if (data && data.length && success) {
											var descendants = [];
											Ext.Array.each(data, function(story) {
												descendants.push(story.get('ObjectID'));
											});
											callback(Ext.Array.unique(descendants));
										} else {
											callback([]);
										}
									}
								}
							});
						}
					}
				}
			});
		},

		getAllDescendants: function() {
			var descendants = [];
			Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection(), function(node) {
				Ext.Array.each(node.raw.descendants, function(descendant) {
					descendants.push(descendant);
				});
			});
			return Ext.Array.unique(descendants);
		}
	},

	viewport: {
		update: function() {
			var gridObj           = {},
				gridArray         = [],
				selectedStoryOIDs = App.rpmTree.getAllDescendants();
			App.down('#viewport').removeAll();
			if (App.rpmTree.getAllDescendants().length == 0) {
				return; //Nothing to render
			} else {
				Ext.getBody().mask('Loading...');
				var filter    = [],
					remaining = Math.ceil(selectedStoryOIDs.length / 100);
				Ext.Array.each(selectedStoryOIDs, function(OID, key) {
					filter.push({
						property : 'ObjectID',
						value    : OID
					});
					if (filter.length == 100 || key == selectedStoryOIDs.length - 1) {
						loadDetails(filter, function() {
							if (!--remaining) {
								//Put grid object data into array for the grid to use
								for (p in gridObj) {
									for (s in gridObj[p]) {
										gridArray.push({
											Team          : p,
											Name          : gridObj[p][s].Name,
											OID           : gridObj[p][s].ObjectID,
											FID           : gridObj[p][s].FormattedID,
											Owner         : (gridObj[p][s].Owner) ? gridObj[p][s].Owner._refObjectName : '',
											PlanEstimate  : gridObj[p][s].PlanEstimate,
											State         : Ext.Array.indexOf(['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'], gridObj[p][s].ScheduleState),
											TaskActual    : gridObj[p][s].TaskActualTotal,
											TaskEstimate  : gridObj[p][s].TaskEstimateTotal,
											TaskRemaining : gridObj[p][s].TaskRemainingTotal
										});
									}
								}
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
										dataIndex : 'FID',
										width     : 60,
										renderer  : function(val, meta, record) {
											return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('OID') + '">' + val + '</a>';
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
										text      : 'Owner',
										dataIndex : 'Owner',
										width     : 150,
										align     : 'center'
									},{
										text      : 'Estimated Task Hours',
										dataIndex : 'TaskEstimate',
										width     : 75,
										align     : 'center'
									},{
										text      : 'Actual Task Hours',
										dataIndex : 'TaskActual',
										width     : 75,
										align     : 'center'
									},{
										text      : 'Remaining Task Hours',
										dataIndex : 'TaskRemaining',
										width     : 75,
										align     : 'center'
									}]
								});
							}
						});
						filter = [];
					}
				});
			}

			function loadDetails(filter, callback) {
				Ext.create('Rally.data.WsapiDataStore', {
					autoLoad: true,
					model: 'UserStory',
					fetch: [
						'FormattedID',
						'Name',
						'ObjectID',
						'Owner',
						'PlanEstimate',
						'Project',
						'ScheduleState',
						'TaskActualTotal',
						'TaskEstimateTotal',
						'TaskRemainingTotal'
					],
					filters: [
						Rally.data.QueryFilter.or(filter),
						App.down('#iterPicker').getQueryFromSelected()
					],
					listeners: {
						load: function(store, data) {
							Ext.Array.each(data, function(s) {
								if (gridObj[s.get('Project').Name] == undefined)
									gridObj[s.get('Project').Name] = [];
								gridObj[s.get('Project').Name].push(s.raw);
							});
							callback();
						}
					}
				});
			}

		}
	}
});