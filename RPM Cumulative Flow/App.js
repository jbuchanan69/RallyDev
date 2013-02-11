// RPM Cumulative Flow - Version 1.0
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout:'border',
	defaults: {
		split       : true,
		autoScroll  : true,
		margins     : '5 0 0 0'
	},
	items: [{
		title       : 'Projects',
		id          : 'left_popout',
		region      : 'west',
		collapsible : true,
		width       : 350,
		layout      : 'fit'
	},{
		id          : 'viewport',
		region      : 'center',
		listeners   : {
			resize  : function() {
				Ext.onReady(function() {
					if (App.down('#chart')) {
						App.down('#chart').setWidth(Ext.get('viewport').getWidth() - 20);
						App.down('#chart').setHeight(Ext.getBody().getHeight() - 20);
		    		}
				});
			}
		}
	},{
		title       : 'Settings',
		id          : 'right_popout',
		region      : 'east',
		collapsible : true,
		width       : 300,
		layout      : 'vbox',
		autoScroll  : false,
		defaults    : {
			listeners : {
				change : function() {
					Ext.onReady(function() {
						App.viewport.update();
					});
				}
			}
		},
		items       : [{
			xtype       : 'rallyiterationcombobox',
			id          : 'minIter',
			fieldLabel  : 'Minimum Iteration:',
			labelWidth  : 88,
			width       : 300,
			margin      : 5 
		},{
			xtype       : 'rallyiterationcombobox',
			id          : 'maxIter',
			fieldLabel  : 'Maximum Iteration:',
			labelWidth  : 88,
			width       : 300,
			margin      : 5
		},{
			xtype       : 'radiogroup',
			id          : 'prop',
			fieldLabel  : 'Property',
			labelWidth  : 100,
			margin      : 5,
			stateful    : true,
			stateId     : 'rpmBdProp',
			stateEvents : [ 'change' ],
			getState    : function() { return { value: this.getValue() }; },
			applyState  : function(state) { this.setValue(state.value); },
	        items       : [
	            {
	            	boxLabel: 'Plan Estimate',
	            	name: 'input',
	            	inputValue: {
	            		prop: 'PlanEstimate',
	            		name: 'Plan Estimate'
	            	},
	            	width: 90,
	            	checked: true
	            },{
	            	boxLabel: 'Hours',
	            	name: 'input',
	            	inputValue: {
	            		prop: 'TaskEstimateTotal',
	            		name: 'Task Hours'
	            	},
	            	width: 90
	            }
	        ]
		}]
	}],

    launch: function() {
    	App = this;
    	App.storyData = {};
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
						//Create tree store using roots
						var nodes = [];
						var childFilter = [];
						Ext.Array.each(roots, function(root) {
							childFilter = [];
							Ext.Array.each(root.get('Children'), function(c) {
								childFilter.push({
									property: 'ObjectID',
									value: c.ObjectID
								});
							});
							nodes.push({
								name        : root.get('Name'),
								childFilter : childFilter,
								text        : root.get('Name'),
								id          : root.get('ObjectID'),
								leaf        : root.raw.Children == undefined || root.raw.Children.length == 0
							});
							if (nodes.length == roots.length) {
								nodes.sort(function(a, b) {
									return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
								});
								var treeStore = Ext.create('Ext.data.TreeStore', {
									root: {
										expanded : true,
										children : nodes
									}
								});
								var newCount = 0;
								//Add tree to UI element
								App.down('#left_popout').add({
									xtype        : 'treepanel',
									store        : treeStore,
									id           : 'rpmTree',
									rootVisible  : false,
									margin       : '-1 0 0 0',
									simpleSelect : true,
									border       : 0,
									listeners: {
										beforeitemexpand: function(node) {
											if (node.hasChildNodes() == false && node.raw.childFilter.length > 0) { //Query for children of selected node
												var newNodes = [];
												var childLoader = Ext.create('Rally.data.WsapiDataStore', {
													context: {
														project          : '/project/2147979614',
														projectScopeDown : true
													},
													model     : 'portfolioitem',
													fetch     : [ 'Children', 'Name', 'ObjectID' ],
													filters   : [ Rally.data.QueryFilter.or(node.raw.childFilter) ],
													listeners : {
														load  : function(model, children) {
															newCount = children.length;
															Ext.Array.each(children, function(child) {
																childFilter = [];
																Ext.Array.each(child.raw.Children, function(c) {
																	childFilter.push({
																		property : 'ObjectID',
																		value    : c.ObjectID
																	});
																});
																newNodes.push({
																	name        : child.get('Name'),
																	childFilter : childFilter,
																	text        : child.get('Name'),
																	id          : child.get('ObjectID'),
																	leaf        : child.raw.Children == undefined || child.raw.Children.length == 0,
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
							}
						});
					}
				}
			});
    	}
    },

    viewport: {
    	update: function() {
    		App.down('#viewport').removeAll();
			var nodes = [];
			var aTime = new Date(App.down('#minIter').getRecord().get('StartDate')).getTime() + 43200000; // Noon
			if (aTime > new Date().getTime()) return;                                                     // Start date is after today
			var bTime = new Date(App.down('#maxIter').getRecord().get('EndDate')).getTime() + 43200000;
			if (bTime > new Date().getTime()) bTime = new Date().getTime();                               // Max end date of today.
			while (aTime < bTime + 43200000) {
				nodes.push({
					time              : new Date(aTime).getTime(),
					date              : Rally.util.DateTime.toIsoString(new Date(aTime)).substring(5, 10).replace('-','/'),
					'Initial Version' : 0,
					'Defined'         : 0,
					'In-Progress'     : 0,
					'Completed'       : 0,
					'Accepted'        : 0
				});
				aTime += 86400000; // 1 Day
			}
    		// Load data into the store
    		Ext.getBody().mask('Loading Chart...');
    		var remaining = nodes.length;
    		if (remaining > 75) {
    			Ext.Msg.alert('Error', 'The maximum iteration range has been exceeded.');
    			Ext.getBody().unmask();
    			return;
    		}
			getSelectedNodes(function(nodeOIDs) {
				if (nodeOIDs.length == 0) {
					Ext.getBody().unmask();
					return; // Nothing selected
				} else {
					getIterOIDs(function(iterOIDs) {
						//Create slices of iterOIDs which are passable to the LBAPI
						var OIDSlices = [], a = -300, b = -1;
						do {
							a += 300;
							b += 300;
							OIDSlices.push(Ext.Array.slice(iterOIDs, a, b));
						} while (b < iterOIDs.length - 1)
						remaining *= OIDSlices.length;
						//Use OID slices to query
						Ext.Array.each(nodes, function(n) {
							Ext.Array.each(OIDSlices, function(slice) {
								Ext.create('Rally.data.lookback.SnapshotStore', {
					    			autoLoad: true,
					    			pageSize: 500,
					    			fetch: ['ObjectID','PlanEstimate','TaskEstimateTotal','ScheduleState'],
					    			hydrate: ['ScheduleState'],
					    			filters: [
					    			    { property: '_ItemHierarchy', operator: 'in', value: nodeOIDs                                          }, // Stories which descend from selected RPM nodes
					    			    { property: 'Iteration',      operator: 'in', value: slice                                             }, // Stories within the selected iteration
					    				{ property: 'Children',                       value: null                                              }, // Only leaf stories
					    				{ property: '__At',                           value: Rally.util.DateTime.toIsoString(new Date(n.time)) }, // Specify the query date
					    				{ property: '_TypeHierarchy',                 value: 'HierarchicalRequirement'                         }  // Specify the type of User Story
					    			],
					                listeners: {
					                	load: function(model, data, success) {
					                		Ext.Array.each(data, function(s) {
					                			n[s.data.ScheduleState] += parseFloat(s.data[App.down('#prop').getValue().input.prop]) || 0;
					                		});
					                		onNode();
					                	}
					                }
					            });
							});							
						});
					});
				}
			});

			function getIterOIDs(callback) {
				var OIDs   = [];
				var loader = Ext.create('Rally.data.WsapiDataStore', {
					model    : 'Iteration',
					fetch    : ['ObjectID'],
					filters  : [
						{ property: 'StartDate', operator: '>=', value: Rally.util.DateTime.toIsoString(App.down('#minIter').getRecord().get('StartDate')) },
						{ property: 'EndDate',   operator: '<=', value: Rally.util.DateTime.toIsoString(App.down('#maxIter').getRecord().get('EndDate'))   }
					],
					listeners : {
						load: function(model, data) {
							if (data && data.length) {
								Ext.Array.each(data, function(i) {
									OIDs.push(i.get('ObjectID'));
								});
								loader.nextPage();
							} else {
								callback(OIDs);
							}
						}
					}
				});
				loader.loadPage(1);
			}

			function getSelectedNodes(callback) {
				var OIDs = [];
	    		Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection(), function(node) {
					OIDs.push(node.raw.id);
				});
				callback(OIDs);
			}

			function onNode() {
				if (!--remaining) {
					Ext.getBody().unmask();
					// Make sure there is data for the chart
					var noData = true;
					Ext.Array.each(nodes, function(n) {
						if (n['Initial Version'] > 0 ||
							n['Defined']         > 0 ||
							n['In-Progress']     > 0 ||
							n['Completed']       > 0 ||
							n['Accepted']        > 0) noData = false;
					});
					if (noData) { Ext.Msg.alert('Error','The query criteria returned zero results.'); return; }
					//Draw chart
					nodes.sort(function(a, b) {
						return a['time'] > b['time'] ? 1 : a['time'] < b['time'] ? -1 : 0;
					});
					App.down('#viewport').add({
						xtype   : 'chart',
						id      : 'chart',
						width   : Ext.get('viewport').getWidth() - 20,
						height  : Ext.getBody().getHeight() - 20,
						margin  : '10 0 0 10',
						animate : true,
						legend  : { position: 'right' },
						store   : Ext.create('Ext.data.JsonStore', {
					        fields : ['time','date','Initial Version','Defined','In-Progress','Completed','Accepted'],
					        data   : nodes
					    }),
					    axes: [{
							type           : 'Numeric',
							position       : 'left',
							fields         : ['Accepted','Completed','In-Progress','Defined','Initial Version'],
							label          : { renderer : Ext.util.Format.numberRenderer('0,0') },
							grid           : true,
							minimum        : 0,
							majorTickSteps : 10,
							title          : App.down('#prop').getValue().input.name
					    }, {
							type     : 'Category',
							position : 'bottom',
							fields   : ['date'],
							title    : 'Date'
					    }],
					    series: [{
							type      : 'area',
							highlight : false,
							axis      : 'left',
							xField    : 'date',
							yField    : ['Accepted','Completed','In-Progress','Defined','Initial Version'],
							style     : { opacity: 0.9 }
					    }]
					});
				}
			}

    	}
    }
});

//API Bug fix for FF 18+
if (Ext.firefoxVersion >= 18) {
	var noArgs = [];
	Ext.override(Ext.Base, {
		callParent : function(args) {
			var method, superMethod = (method = this.callParent.caller) && (method.$previous || ((method = method.$owner ? method : method.caller) && method.$owner.superclass[method.$name]));
			try {} catch (e) {}
			return superMethod.apply(this, args || noArgs);
		}
	});
}