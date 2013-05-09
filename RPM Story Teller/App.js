// RPM Story Teller - Version 1.4.1
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
		title   : 'Settings',
		id      : 'popout',
		region  : 'west',
		margins : '5 0 0 0',
		width   : 270,
		tools: [{
			type    :'save',
			handler : function(event, toolEl, panel){
		    	Ext.onReady(function() {
		    		if (/*@cc_on!@*/0) { //Exporting to Excel not supported in IE
			            Ext.Msg.alert('Error', 'Exporting to CSV is not supported in Internet Explorer. Please switch to a different browser and try again.');
			        } else if (App.down('#viewport_grid')) {
                    	Ext.getBody().mask('Exporting Chart...');
	                    setTimeout(function() {
	                        var template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';
	                        var base64   = function(s) { return window.btoa(unescape(encodeURIComponent(s))) };
	                        var format   = function(s, c) { return s.replace(/{(\w+)}/g, function(m, p) { return c[p]; }) };
	                        var table    = document.getElementById('viewport_grid');

	                        var excel_data = '<tr>';
	                        Ext.Array.each(table.innerHTML.match(/<span .*?x-column-header-text.*?>.*?<\/span>/gm), function(column_header_span) {
	                            excel_data += (column_header_span.replace(/span/g,'td'));
	                        });
	                        excel_data += '</tr>';
	                        Ext.Array.each(table.innerHTML.match(/<tr class="x-grid-row.*?<\/tr>/gm), function(line) {
	                        	if (!line.match(/x-grid-row-summary/)) excel_data += line.replace(/___/g,' ');
	                        });

	                        var ctx = {worksheet: name || 'Worksheet', table: excel_data};
	                        window.location.href = 'data:application/vnd.ms-excel;base64,' + base64(format(template, ctx));
	                        Ext.getBody().unmask();
	                    }, 500);
                    }
                });
		    }
		}],
		layout: {
			type  : 'vbox',
			align : 'stretch'
		},
		items: [{
			id      : 'settingsPanel',
			layout  : 'vbox',
			height  : 38,
			border  : 0,
			padding : 5,
			style   : {
				borderBottom  : '1px solid #99BCE8'
			},
			items   : [{
				xtype      : 'rallyiterationcombobox',
				id         : 'iterPicker',
				width      : 270,
				margins    : '3 0 0 0',
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
		App = this;
		App.usStore = {};
		App.rpmTree.init();
	},

	rpmTree: {
		init: function() {
			Ext.create('Rally.data.WsapiDataStore', {
	            autoLoad: true,
	            model: 'PortfolioItem/Initiative',
	            fetch: [
	            	'Children',
	            	'LeafStoryCount',
	            	'Name',
	            	'ObjectID'
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
									autoLoad : true,
									model    : 'PortfolioItem/' + child_type,
									filters  : [{
										property : 'Parent.ObjectID',
										value    : node.raw.id
									}],
									fetch     : ['Children','LeafStoryCount','Name','ObjectID'],
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

	viewport: {
		update: function() {
			var gridArray = [];
			var totalsArray = [{
				TotalPlanEstimate       : 0,
				TotalEstimatedTaskHours : 0,
				TotalActualTaskHours    : 0,
				TotalRemainingTaskHours : 0
			}];
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
						hideHeaders       : true,
						store             : Ext.create('Rally.data.custom.Store', {
							data     : totalsArray,
							pageSize : 1,
						}),
						columnCfgs : [{
							flex      : 1
						},{
							width     : 75,
							align     : 'center',
							dataIndex : 'TotalPlanEstimate',
							renderer  : function(val) { return '<b>' + (Math.round(val * 100) / 100) + '</b>'; }
						},{
							width     : 75,
							align     : 'center',
							dataIndex : 'TotalEstimatedTaskHours',
							renderer  : function(val) { return '<b>' + (Math.round(val * 100) / 100) + '</b>'; }
						},{
							width     : 75,
							align     : 'center',
							dataIndex : 'TotalActualTaskHours',
							renderer  : function(val) { return '<b>' + (Math.round(val * 100) / 100) + '</b>'; }
						},{
							width     : 75,
							align     : 'center',
							dataIndex : 'TotalRemainingTaskHours',
							renderer  : function(val) { return '<b>' + (Math.round(val * 100) / 100) + '</b>'; }
						}]
					});
					App.down('#viewport').add({
						xtype             : 'rallygrid',
						id                : 'viewport_grid',
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
						features: [{
							id: 'group',
				            ftype: 'groupingsummary',
				            groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
						}],
						columnCfgs: [{
							text      : 'Team',
							dataIndex : 'TeamNoSpace',
							hidden    : true
						},{
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
							text            : 'Plan Estimate',
							dataIndex       : 'PlanEstimate',
							width           : 75,
							align           : 'center',
							summaryType     : 'sum',
							summaryRenderer : function(val, data, idx) {
				                return '<b>' + (Math.round(val * 100) / 100) + '</b>';
				            }
						},{
							text            : 'Estimated Task Hours',
							dataIndex       : 'TaskEstimateTotal',
							width           : 75,
							align           : 'center',
							summaryType     : 'sum',
							summaryRenderer : function(val, data, idx) {
				                return '<b>' + (Math.round(val * 100) / 100) + '</b>';
				            }
						},{
							text            : 'Actual Task Hours',
							dataIndex       : 'TaskActualTotal',
							width           : 75,
							align           : 'center',
							summaryType     : 'sum',
							summaryRenderer : function(val, data, idx) {
				                return '<b>' + (Math.round(val * 100) / 100) + '</b>';
				            }
						},{
							text            : 'Remaining Task Hours',
							dataIndex       : 'TaskRemainingTotal',
							width           : 75,
							align           : 'center',
							summaryType     : 'sum',
							summaryRenderer : function(val, data, idx) {
				                return '<b>' + (Math.round(val * 100) / 100) + '</b>';
				            }
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
												s.raw.Team        = iterProjectHash[s.raw.Iteration];
												s.raw.TeamNoSpace = iterProjectHash[s.raw.Iteration].replace(/ /g,'___');
												s.raw.State       = Ext.Array.indexOf(['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'], s.raw.ScheduleState);
												
												totalsArray[0].TotalPlanEstimate       += parseFloat(s.raw.PlanEstimate)       || 0.0;
												totalsArray[0].TotalEstimatedTaskHours += parseFloat(s.raw.TaskEstimateTotal)  || 0.0;
												totalsArray[0].TotalActualTaskHours    += parseFloat(s.raw.TaskActualTotal)    || 0.0;
												totalsArray[0].TotalRemainingTaskHours += parseFloat(s.raw.TaskRemainingTotal) || 0.0;

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