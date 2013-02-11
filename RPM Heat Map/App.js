// RPM Heat Map - Version 2.1.4
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
		tools: [{ 
			id: 'help',
			handler: function(){
				Ext.create('Rally.ui.dialog.Dialog', {
					autoShow  : true,
					closable  : true,
					draggable : true,
					width     : 290,
					title     : 'RPM Heat Map - Help',
					items     : {
						xtype: 'component',
						html: '                                                  \
							<div><b>Color Key:</b></div>                         \
							<div class="key_row">                                \
								<div class="key_label">% Accepted: </div>        \
								<div class="green label half">100%</div>         \
								<div class="yellow label half">50%-99%</div>     \
								<div class="red label half">&lt50%</div>         \
							</div>                                               \
							<div class="key_row">                                \
								<div class="key_label">Defects / Blocks: </div>  \
								<div class="green label half">0</div>            \
								<div class="yellow label half">1</div>           \
								<div class="red label half">2</div>              \
							</div>                                               \
							<div class="key_row">                                \
								<div class="key_label">Scope Change: </div>      \
								<div class="green label half">&lt10%</div>       \
								<div class="yellow label half">10%-25%</div>     \
								<div class="red label half">&gt25%</div>         \
							</div>                                               \
						',
						padding: 10
					}
				});
			}
		}],
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
							if (App.rpmTree.getSelectedRPMNodes().length != 0) App.viewport.update();
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
		},

		getSelectedRPMNodes: function() {
			var OIDs = [];
			Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection(), function(node) {
				OIDs.push(node.data.id);
			});
			return OIDs;
		}
	},

	iterPicker : {
		getIterOIDs: function(callback) {
			var OIDs = [];
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
							OIDs.push(i.raw.ObjectID);
						});
						callback(OIDs);
					}
				}
			});
		}
	},

	viewport: {
		update: function() {
			var gridObj   = {};
			var gridArray = [];
			Ext.getBody().mask('Loading...');
			App.down('#viewport').removeAll();
			if (App.rpmTree.getSelectedRPMNodes().length == 0) return; //Nothing to render
			App.iterPicker.getIterOIDs(function(iterOIDs) {
				var rpmOIDs = App.rpmTree.getSelectedRPMNodes();
				
				getDataOn(Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(App.down('#iterPicker').getRecord().get('StartDate')), Ext.Date.DAY, 2)), 0, function() {
					getDataOn(Rally.util.DateTime.toIsoString(new Date(App.down('#iterPicker').getRecord().get('EndDate'))), 1, function() {
						getProjectNames(function() {
							// Process rates and push project data to array
							for (p in gridObj) {
								gridObj[p].ScopeChange      = (gridObj[p].InitialScope == 0) ? ((gridObj[p].FinalScope == 0) ? 0 : 1) : parseFloat((gridObj[p].FinalScope / gridObj[p].InitialScope) - 1) || 0.0;
								gridObj[p].AcceptedByPoints = (gridObj[p].FinalScope   == 0) ? 1 : parseFloat(gridObj[p].AcceptedPoints / gridObj[p].FinalScope)     || 0.0;
								gridObj[p].AcceptedByCount  = (gridObj[p].StoryCount   == 0) ? 1 : parseFloat(gridObj[p].AcceptedStoryCount / gridObj[p].StoryCount) || 0.0;
								gridObj[p].HoursRemaining   = (gridObj[p].TaskEstTotal == 0) ? 1 : parseFloat(gridObj[p].TaskRemTotal / gridObj[p].TaskEstTotal)     || 0.0;
								gridObj[p].EstVsActHours    = (gridObj[p].TaskEstTotal == 0) ? 1 : parseFloat(gridObj[p].TaskActTotal / gridObj[p].TaskEstTotal)     || 0.0;
								//Set overall color based on other values
								if (gridObj[p].AcceptedByCount       <   1  ||
									gridObj[p].AcceptedByPoints      <   1  ||
									Math.abs(gridObj[p].ScopeChange) >= .1  ||
									gridObj[p].Defects               >   0  ||
									gridObj[p].Blocks                >   0) gridObj[p].Color = 1; //Yellow
								if (gridObj[p].AcceptedByCount       <= .5  ||
									gridObj[p].AcceptedByPoints      <= .5  ||
									Math.abs(gridObj[p].ScopeChange) >= .25 ||
									gridObj[p].Defects               >   1  ||
									gridObj[p].Blocks                >   1) gridObj[p].Color = 2; //Red
								gridArray.push(gridObj[p]);
							}
							drawGrid();
						});
					});
				});
			
				function getDataOn(date, idx, callback) {
					Ext.create('Rally.data.lookback.SnapshotStore', {
						autoLoad: true,
						pageSize: 1000000,
						fetch: ['Blocked','Defects','ObjectID','Project','PlanEstimate','ScheduleState','TaskActualTotal','TaskEstimateTotal','TaskRemainingTotal'],
						hydrate: ['ScheduleState'],
						filters: [
							{ property: '_ItemHierarchy', operator: 'in', value: rpmOIDs                   }, // Descends from selected RPM level
							{ property: 'Iteration',      operator: 'in', value: iterOIDs                  }, // Only pull stories in the selected iteration
							{ property: 'Children',                       value: null                      }, // Leaf stories only
							{ property: '__At',                           value: date                      }, // Look back to selected date
							{ property: '_TypeHierarchy',                 value: 'HierarchicalRequirement' }  // Only pull User Stories
						],
						listeners: {
							load: function(model, data, success) {
								Ext.Array.each(data, function(s) {
									if (gridObj[s.raw.Project] == undefined) {
										gridObj[s.raw.Project] = {
											StoryCount         : 0,
											AcceptedStoryCount : 0,
											AcceptedPoints     : 0,
											TaskEstTotal       : 0,
											TaskRemTotal       : 0,
											TaskActTotal       : 0,
											InitialScope       : 0,
											FinalScope         : 0,
											DefectCount        : 0,
											BlockCount         : 0,
											Color              : 0
										};
									}
									if (idx == 0) { // Querying for data at beginning of the sprint
										gridObj[s.raw.Project].InitialScope += s.raw.PlanEstimate || 0;
									} else { //Querying for data at the end of the sprint
										gridObj[s.raw.Project].StoryCount++;
										gridObj[s.raw.Project].FinalScope   += s.raw.PlanEstimate       || 0;
										gridObj[s.raw.Project].TaskEstTotal += s.raw.TaskEstimateTotal  || 0;
										gridObj[s.raw.Project].TaskRemTotal += s.raw.TaskRemainingTotal || 0;
										gridObj[s.raw.Project].TaskActTotal += s.raw.TaskActualTotal    || 0;
										if (s.raw.Blocked) gridObj[s.raw.Project].BlockCount++;
										if (s.raw.Defects && s.raw.Defects.length) gridObj[s.raw.Project].DefectCount += s.raw.Defects.length;
										if (s.raw.ScheduleState == 'Accepted') {
											gridObj[s.raw.Project].AcceptedStoryCount++;
											gridObj[s.raw.Project].AcceptedPoints += s.raw.PlanEstimate || 0;
										}
									}
								});
								callback();
							}
						}
					});
				}

				function getProjectNames(callback) {
					var filter = [];
					for (p in gridObj) {
						filter.push({
							property : 'ObjectID',
							value    : p
						});
					}
					if (filter.length == 0) {
						Ext.Msg.alert('Error', 'No data found for selected iteration.');
						Ext.getBody().unmask();
						return;
					}
					Ext.create('Rally.data.WsapiDataStore', {
						autoLoad  : true,
						model     : 'Project',
						fetch     : ['Name','ObjectID'],
						filters   : [Rally.data.QueryFilter.or(filter)],
						listeners : {
							load: function(model, data) {
								Ext.Array.each(data, function(p) {
									if (gridObj[p.raw.ObjectID]) gridObj[p.raw.ObjectID].Team = p.raw.Name;
								});
								callback();
							}
						}
					});
				}

				function drawGrid() {
					Ext.getBody().unmask();
					var grid = App.down('#viewport').add({
						xtype : 'rallygrid',
						disableSelection: true,
						store : Ext.create('Rally.data.custom.Store', {
							data    : gridArray,
							sorters : [
								{ property: 'AcceptedByPoints', direction: 'DESC' },
								{ property: 'FinalScope',       direction: 'DESC' }
							]
						}),
						columnCfgs: [{
							text      : 'Team',
							dataIndex : 'Team',
							flex      : 1
						},{
							text      : '',
							dataIndex : 'Color',
							width     : 65,
							renderer  : function(val) {
								return '<div class="' + ['green','yellow','red'][val] + ' label half"></div>';
							}
						},{
							text      : 'Actual vs Estimated Hours',
							dataIndex : 'EstVsActHours',
							width     : 130,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="label"><div class="align">' + Math.round(val * 100) + '%</div><div class="align">' + Math.round(record.get('TaskActTotal')) + ' / ' + Math.round(record.get('TaskEstTotal')) + '</div></div>';
							}
						},{
							text      : 'Remaining Hours',
							dataIndex : 'TaskRemTotal',
							width     : 65,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="label half">' + val + '</div>';
							}
						},{
							text      : 'Accepted Story Count',
							dataIndex : 'AcceptedByCount',
							width     : 130,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="' + getColorFromVal(val, [1,1], [.5,1], [0,.5], record) + ' label"><div class="align">' + Math.round(val * 100) + '%</div><div class="align">' + record.get('AcceptedStoryCount') + ' of ' + record.get('StoryCount') +'</div>';
							}
						},{
							text      : 'Accepted Story Scope',
							dataIndex : 'AcceptedByPoints',
							width     : 130,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="' + getColorFromVal(val, [1,1], [.5,1], [0,.5], record) + ' label"><div class="align">' + Math.round(val * 100) + '%</div><div class="align">' + record.get('AcceptedPoints') + ' of ' + record.get('FinalScope') +'</div>';
							}
						},{
							text      : 'Blocks',
							dataIndex : 'BlockCount',
							width     : 65,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="' + getColorFromVal(val, [0,0], [1,1], [2,1000], record) + ' label half">' + val + '</div>';
							}
						},{
							text      : 'Defects',
							dataIndex : 'DefectCount',
							width     : 65,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="' + getColorFromVal(val, [0,0], [1,1], [2,1000], record) + ' label half">' + val + '</div>';
							}
						},{
							text      : 'Scope Change',
							dataIndex : 'ScopeChange',
							width     : 130,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="' + getColorFromVal(val, [0,.1], [.1,.25], [.25,1000], record) + ' label"><div class="align">' + Math.round(val * 100) + '%</div><div class="align">' + record.get('InitialScope') + ' &rArr; ' + record.get('FinalScope') +'</div>';
							}
						}]
					});
				}

				function getColorFromVal(val, gRange, yRange, rRange, record) {
					val = Math.abs(val);
					if      (val >= gRange[0] && val <= gRange[1]) return 'green';
					else if (val >= yRange[0] && val <= yRange[1]) return 'yellow';
					else if (val >= rRange[0] && val <= rRange[1]) return 'red';
					else return '';
				}

			});
		}
	}

});