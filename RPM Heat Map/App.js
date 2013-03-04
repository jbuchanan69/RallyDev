// RPM Heat Map - Version 2.3.2
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
					width     : 300,
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
							if (App.down('#rpmTree').getSelectionModel().getSelection().length > 0) App.viewport.update();
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
		App.down('#viewport').addListener('resize', function() {
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
			if (App.down('#rpmTree').getSelectionModel().getSelection().length == 0) return; //Nothing to render
			var gridObj   = {};
			var gridArray = [];
			Ext.getBody().mask('Loading...');
			App.down('#viewport').removeAll();
			App.iterPicker.getIterOIDs(function(iterOIDs) {
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
								// Set overall color based on other values
								if (gridObj[p].AcceptedByCount       <   1  ||
									gridObj[p].AcceptedByPoints      <   1  ||
									Math.abs(gridObj[p].ScopeChange) >= .1  ||
									gridObj[p].DefectCount           >   0  ||
									gridObj[p].BlockCount            >   0) gridObj[p].Color = 1; //Yellow
								if (gridObj[p].AcceptedByCount       <= .5  ||
									gridObj[p].AcceptedByPoints      <= .5  ||
									Math.abs(gridObj[p].ScopeChange) >= .25 ||
									gridObj[p].DefectCount           >   1  ||
									gridObj[p].BlockCount            >   1) gridObj[p].Color = 2; //Red
								// Mark stories in the initial scope but not in the final scope as red
								Ext.Array.each(gridObj[p].InitialStories, function(s) {
									switch (cmpFn(s, gridObj[p].FinalStories)) {
										case -1 : s.Color = 1; break;
										case 0  : s.Color = 2; break;
									}
								});
								// // Mark stories in the final scope but not in the initial scope as green
								Ext.Array.each(gridObj[p].FinalStories, function(s) {
									switch (cmpFn(s, gridObj[p].InitialStories)) {
										case -1 : s.Color = 0; break;
										case 0  : s.Color = 2; break;
									}
								});
								gridArray.push(gridObj[p]);
							}
							drawGrid();
						
							function cmpFn(item, cmpStore) {
								for (s in cmpStore) {
									if (cmpStore[s].ObjectID == item.ObjectID) {                     // Items exists in both stores
										if (cmpStore[s].PlanEstimate != item.PlanEstimate) return 0; // Points value has changed
										else return 1;                                               // No changes have been made
									}
								}
								return -1;                                                           // Item not in other store
							}
						});
					});
				});

				function getDataOn(date, idx, callback) {
					Ext.create('Rally.data.lookback.SnapshotStore', {
						autoLoad: true,
						pageSize: 1000000,
						fetch: ['_UnformattedID','Blocked','BlockedReason','CreationDate','Defects','Name','ObjectID','Project','PlanEstimate','ScheduleState','TaskActualTotal','TaskEstimateTotal','TaskRemainingTotal'],
						hydrate: ['ScheduleState'],
						filters: [
							{ property: '_ItemHierarchy', operator: 'in', value: App.down('#rpmTree').getSelectionModel().getSelection()[0].data.id }, // Descends from selected RPM level
							{ property: 'Iteration',      operator: 'in', value: iterOIDs                                                           }, // Only pull stories in the selected iteration
							{ property: 'Children',                       value: null                                                               }, // Leaf stories only
							{ property: '__At',                           value: date                                                               }, // Look back to selected date
							{ property: '_TypeHierarchy',                 value: 'HierarchicalRequirement'                                          }  // Only pull User Stories
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
											Color              : 0,
											InitialStories     : [],
											FinalStories       : [],
											BlockedStories     : [],
											Defects            : [],
											DefectOIDs         : []
										};
									}
									if (idx == 0) { // Querying for data at beginning of the sprint
										gridObj[s.raw.Project].InitialScope += s.raw.PlanEstimate || 0;
										s.raw.Color = -1; gridObj[s.raw.Project].InitialStories.push(s.raw);
									} else { //Querying for data at the end of the sprint
										gridObj[s.raw.Project].StoryCount++;
										gridObj[s.raw.Project].FinalScope   += s.raw.PlanEstimate       || 0;
										gridObj[s.raw.Project].TaskEstTotal += s.raw.TaskEstimateTotal  || 0;
										gridObj[s.raw.Project].TaskRemTotal += s.raw.TaskRemainingTotal || 0;
										gridObj[s.raw.Project].TaskActTotal += s.raw.TaskActualTotal    || 0;
										s.raw.Color = -1; gridObj[s.raw.Project].FinalStories.push(s.raw);
										if (s.raw.Blocked) {
											gridObj[s.raw.Project].BlockCount++;
											gridObj[s.raw.Project].BlockedStories.push(s.raw);
										}
										if (s.raw.Defects && s.raw.Defects.length) {
											Ext.create('Rally.data.lookback.SnapshotStore', {
												autoLoad: true,
												fetch: ['_UnformattedID','Name','State','Priority','Severity'],
												hydrate: ['State','Priority','Severity'],
												filters: [
													{ property: '__At',                           value: 'current'     },
													{ property: '_TypeHierarchy',                 value: 'Defect'      },
													{ property: 'ObjectID',       operator: 'in', value: s.raw.Defects }
												],
												listeners: {
													load: function(store, data) {
														Ext.Array.each(data, function(d) {
															if (d.raw.State != 'Closed') gridObj[s.raw.Project].DefectCount++;
															gridObj[s.raw.Project].Defects.push(d.raw);
														});
														if (gridObj[s.raw.Project].DefectCount == 0) gridObj[s.raw.Project].DefectCount = -1;
													}
												}
											});
										}
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
						showPagingToolbar: false,
						features: [{
							ftype: 'summary'
						}],
						store : Ext.create('Rally.data.custom.Store', {
							data     : gridArray,
							sorters  : [
								{ property: 'AcceptedByPoints', direction: 'DESC' },
								{ property: 'FinalScope',       direction: 'DESC' }
							],
							pageSize : 1000
						}),
						columnCfgs: [{
							text        : 'Team',
							dataIndex   : 'Team',
							flex        : 1,
							summaryType : function() {
								return '<div class="qSummary">' + App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.name + '<br />' + App.down('#iterPicker').getRawValue() + '</div>';
							}
						},{
							text      : '',
							dataIndex : 'Color',
							width     : 25,
							renderer  : function(val) {
								return '<div class="' + ['green','yellow','red'][val] + ' label square"></div>';
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
								return '<div class="' + getColorFromVal(((val < 0) ? 0 : val), [0,0], [1,1], [2,1000], record) + ' label half">' + ((val < 0) ? '&bull; 0 &bull;' : val) + '</div>';
							}
						},{
							text      : 'Scope Change',
							dataIndex : 'ScopeChange',
							width     : 130,
							align     : 'center',
							renderer  : function(val, meta, record) {
								return '<div class="' + getColorFromVal(val, [0,.1], [.1,.25], [.25,1000], record) + ' label"><div class="align">' + Math.round(val * 100) + '%</div><div class="align">' + record.get('InitialScope') + ' &rArr; ' + record.get('FinalScope') +'</div>';
							}
						}],
						listeners: {
							itemclick: function(view, record, item, index, evt) {
								var column = view.getPositionByEvent(evt).column;
								if (column == 6) { //Blocks Report
									if (record.get('BlockedStories').length == 0) return;
									//Get Blocked Dates for each blocked User Story
									Ext.getBody().mask('Loading...');
									var remaining = record.get('BlockedStories').length;
									Ext.Array.each(record.get('BlockedStories'), function(s) {
										getBlockedDate(s, function(blocked_date) {
											s.BlockedDate = blocked_date;
											if (!--remaining) {
												Ext.getBody().unmask();
												App.popup = Ext.create('Rally.ui.dialog.Dialog', {
													autoShow    : true,
													width       : Ext.getBody().getWidth(),
													height      : Ext.getBody().getHeight(),
													autoScroll  : true,
													closable    : true,
													title       : record.get('Team') + ' - Blocked Stories',
													items: [{
														xtype             : 'rallygrid',
														layout            : 'fit',
														showPagingToolbar : false,
														disableSelection  : true,
														columnCfgs        : [
															{ text: 'ID',             dataIndex: '_UnformattedID', width: 60, renderer: function(val) { return 'US' + val; } },
															{ text: 'Name',           dataIndex: 'Name',           flex: 1                                                   },
															{ text: 'Blocked Reason', dataIndex: 'BlockedReason',  flex: 1                                                   },
															{ text: 'Blocked Date',   dataIndex: 'BlockedDate',    width: 80                                                 }
														],
														store : Ext.create('Rally.data.custom.Store', {
															data     : record.get('BlockedStories'),
															fields   : ['_UnformattedID','Name','BlockedReason','BlockedDate'],
															sorters  : [ { property: '_UnformattedID', direction: 'ASC' } ],
															pageSize : 1000
														})
													}],
													listeners: {
														afterrender: function() {
															this.toFront();
															this.focus();
														}
													}
												});
											}
										});
									});
								} else if (column == 7) { // Defects Report
									if (record.get('Defects').length == 0) return;
									App.popup = Ext.create('Rally.ui.dialog.Dialog', {
										autoShow    : true,
										width       : Ext.getBody().getWidth(),
										height      : Ext.getBody().getHeight(),
										autoScroll  : true,
										closable    : true,
										title       : record.get('Team') + ' - Defects',
										items: [{
											xtype             : 'rallygrid',
											layout            : 'fit',
											showPagingToolbar : false,
											disableSelection  : true,
											columnCfgs        : [
												{ text: 'ID',       dataIndex: '_UnformattedID', width: 60, renderer: function(val) { return 'DE' + val; } },
												{ text: 'Name',     dataIndex: 'Name',           flex: 1                                                   },
												{ text: 'State',    dataIndex: 'State',          width: 125, align: 'center'                               },
												{ text: 'Priority', dataIndex: 'Priority',       width: 125, align: 'center'                               },
												{ text: 'Severity', dataIndex: 'Severity',       width: 125, align: 'center'                               }
											],
											store : Ext.create('Rally.data.custom.Store', {
												data     : record.get('Defects'),
												fields   : ['_UnformattedID','Name','State','Priority','Severity'],
												sorters  : [ { property: '_UnformattedID', direction: 'ASC' } ],
												pageSize : 1000
											})
										}],
										listeners: {
											afterrender: function() {
												this.toFront();
												this.focus();
											}
										}
									});
								} else if (column == 8) { // Scope Change Report
									var initialScopeDate = (Ext.Date.add(new Date(App.down('#iterPicker').getRecord().get('StartDate')), Ext.Date.DAY, 2) < new Date()) ? Ext.Date.add(new Date(App.down('#iterPicker').getRecord().get('StartDate')), Ext.Date.DAY, 2) : new Date();
									var finalScopeDate   = (new Date(App.down('#iterPicker').getRecord().get('EndDate')) < new Date()) ? new Date(App.down('#iterPicker').getRecord().get('EndDate')) : new Date();
									App.popup = Ext.create('Rally.ui.dialog.Dialog', {
										autoShow    : true,
										width       : Ext.getBody().getWidth(),
										height      : Ext.getBody().getHeight(),
										autoScroll  : true,
										closable    : true,
										layout      : {
											align : 'stretch',
											type  : 'hbox'
										},
										title    : '<div class="titleBar"><div>' + record.get('Team') + ' - Scope Change Report</div><div class="left">Initial Scope: ' + Rally.util.DateTime.toIsoString(initialScopeDate).substring(0, 10) + '</div><div class="right">Final Scope: ' + Rally.util.DateTime.toIsoString(finalScopeDate).substring(0, 10) + '</div></div>',
										defaults : {
											xtype  : 'rallygrid',
											width  : '49.9%',
											style             : { border : '1px solid #99BCE8' },
											showPagingToolbar : false,
											disableSelection  : true,
											columnCfgs        : [
												{ text: '',              dataIndex: 'Color',          width: 25, renderer: function(val) { return (val >= 0) ? '<div class="' + ['green','red','yellow'][val] + ' label square">' + ['+','-','C'][val] + '</div>' : ''; } },
												{ text: 'ID',            dataIndex: '_UnformattedID', width: 60, renderer: function(val) { return 'US' + val;                                                                                                           } },
												{ text: 'Name',          dataIndex: 'Name',           flex: 1                                                                                                                                                             },
												{ text: 'Plan Estimate', dataIndex: 'PlanEstimate',   width: 60, align: 'center'                                                                                                                                          },
												{ text: 'State',         dataIndex: 'ScheduleState',  width: 90, align: 'center'                                                                                                                                          }
											]
										},
										items: [{
											store : Ext.create('Rally.data.custom.Store', {
												data     : record.get('InitialStories'),
												fields   : ['Color','_UnformattedID','Name','PlanEstimate','ScheduleState'],
												sorters  : [
													{ property: 'Color',          direction: 'DESC' },
													{ property: '_UnformattedID', direction: 'ASC'  }
												],
												pageSize : 1000
											})
										},{
											xtype : 'container',
											width : '.1%',
											cls   : 'split'
										},{
											store : Ext.create('Rally.data.custom.Store', {
												data     : record.get('FinalStories'),
												sorters  : [
													{ property: 'Color',          direction: 'DESC' },
													{ property: '_UnformattedID', direction: 'ASC'  }
												],
												pageSize : 1000
											})
										}],
										listeners: {
											afterrender: function() {
												this.toFront();
												this.focus();
											}
										}
									});
								}

								function getBlockedDate(s, callback) {
									var blocked_date = s.CreationDate.substring(0,10);
									Ext.create('Rally.data.WsapiDataStore', {
										model: 'UserStory',
										autoLoad: true,
										fetch: ['RevisionHistory','Revisions'],
										filters: [{
											property: 'ObjectID', value: s.ObjectID
										}],    
										listeners: {
											load: function(store, data) {
												var endTime = parseInt(Date.parse(App.down('#iterPicker').getRecord().get('EndDate')));
												if (data[0] && data[0].get('RevisionHistory') && data[0].get('RevisionHistory').Revisions) {
													Ext.Array.each(data[0].get('RevisionHistory').Revisions, function(r) {
														if (r.Description.match(/BLOCKED changed from \[false\] to \[true\]/) && parseInt(Date.parse(Rally.util.DateTime.fromIsoString(r.CreationDate))) < endTime) {
															blocked_date = r.CreationDate.substring(0,10);
														}
													});
													callback(blocked_date);
												} else {
													callback(blocked_date);
												}
											}
										} 
									});
								}


							}
						}
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