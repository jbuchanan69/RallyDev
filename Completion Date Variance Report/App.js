// Completion Date Variance Report - Version 0.1.1
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
		tools: [{
			type    : 'expand',
			handler : function() {
				Ext.onReady(function() {
					Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection(), function(node) {
						node.expand();
					});
				});
			}
		},{
			type    :'save',
			handler : function(event, toolEl, panel){
		    	Ext.onReady(function() {
		    		if (/*@cc_on!@*/0) { //Exporting to Excel not supported in IE
			            Ext.Msg.alert('Error', 'Exporting to CSV is not supported in Internet Explorer. Please switch to a different browser and try again.');
			        } else if (App.down('#rally_grid')) {
                    	Ext.getBody().mask('Exporting Chart...');
	                    setTimeout(function() {
	                        var template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';
	                        var base64   = function(s) { return window.btoa(unescape(encodeURIComponent(s))) };
	                        var format   = function(s, c) { return s.replace(/{(\w+)}/g, function(m, p) { return c[p]; }) };
	                        var table    = document.getElementById('rally_grid');
	                        
	                        var excel_data = '<tr>';
	                        Ext.Array.each(table.innerHTML.match(/<span .*?x-column-header-text.*?>.*?<\/span>/gm), function(column_header_span) {
	                            excel_data += (column_header_span.replace(/span/g,'td'));
	                        });
	                        excel_data += '</tr>';
	                        Ext.Array.each(table.innerHTML.match(/<tr class="x-grid-row.*?<\/tr>/gm), function(line) {
	                        	excel_data += line;
	                        });

	                        var ctx = {worksheet: name || 'Worksheet', table: excel_data};
	                        window.location.href = 'data:application/vnd.ms-excel;base64,' + base64(format(template, ctx));
	                        Ext.getBody().unmask();
	                    }, 500);
                    }
                });
		    }
		}],
		items: [{
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
		App            = this;
		App.iterations = [];
		App.lbDates    = [];
		var loader = Ext.create('Rally.data.WsapiDataStore', {
			model     : 'Iteration',
			fetch     : ['Name','ObjectID','StartDate','EndDate'],
			filters   : [{
				property : 'Project.ObjectID',
				value    : App.getContext().getProject().ObjectID
			}],
			sorters   : [{
				property  : 'EndDate',
				direction : 'DESC'
			}],
			listeners : {
				load : function(store, data) {
					if (data && data.length) {
						Ext.Array.each(data, function(i) {
							if (Rally.util.DateTime.getDifference(new Date(), Rally.util.DateTime.fromIsoString(i.raw.EndDate), 'day') < 105 &&
								Rally.util.DateTime.getDifference(new Date(), Rally.util.DateTime.fromIsoString(i.raw.EndDate), 'day') > 0) {
								App.lbDates.push(i.raw.EndDate);
							}
							if (i.raw.StartDate < Rally.util.DateTime.toIsoString(new Date()) && i.raw.EndDate > Rally.util.DateTime.toIsoString(new Date())) App.currentSprintIndex = App.iterations.length;
							App.iterations.push(i.raw);
						});
						loader.nextPage();
					} else {
						App.rpmTree.init();
					}
				}
			}
		});
		loader.loadPage(1);
	},

	rpmTree: {
		updateTimeout : null,
		init          : function() {
			Ext.create('Rally.data.WsapiDataStore', {
	            autoLoad: true,
	            model: 'PortfolioItem/Initiative',
	            fetch: ['Children','LeafStoryCount','Name','ObjectID','PortfolioItemTypeName','UnEstimatedLeafStoryCount','LeafStoryCount','LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal','PlannedStartDate','PlannedEndDate','ActualEndDate'],
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
									name   : i.raw.Name,
									text   : '<span class="count">' + i.raw.LeafStoryCount + '</span><span class="nodeTitle">' + i.raw.Name + '</span>',
									id     : i.raw.ObjectID,
									type   : i.raw.PortfolioItemTypeName,
									sCnt   : i.raw.LeafStoryCount,
									ueCnt  : i.raw.UnEstimatedLeafStoryCount,
									peCnt  : i.raw.LeafStoryPlanEstimateTotal,
									aPeCnt : i.raw.AcceptedLeafStoryPlanEstimateTotal,
									pStart : i.raw.PlannedStartDate,
									pEnd   : i.raw.PlannedEndDate,
									aEnd   : i.raw.ActualEndDate,
									leaf   : i.raw.Children == undefined || i.raw.Children.length == 0
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
					multiSelect : true,
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
					allowDeselect : false,
					listeners    : {
						added    : function() {
							App.down('#popout').setWidth(300);
							Ext.getBody().unmask();
						},
						beforeitemexpand: function(node) {
							if (node.hasChildNodes() == false) { // Child nodes have not been populated yet
								getChildren('Rollup', function(rollup_children) {
									getChildren('Feature', function(feature_children) {
										var children = [];
										Ext.Array.each(rollup_children.concat(feature_children), function(c) {
											children.push({
												name   : c.raw.Name,
												text   : '<span class="count">' + c.raw.LeafStoryCount + '</span><span class="nodeTitle">' + c.raw.Name + '</span>',
												id     : c.raw.ObjectID,
												type   : c.raw.PortfolioItemTypeName,
												sCnt   : c.raw.LeafStoryCount,
												ueCnt  : c.raw.UnEstimatedLeafStoryCount,
												peCnt  : c.raw.LeafStoryPlanEstimateTotal,
												aPeCnt : c.raw.AcceptedLeafStoryPlanEstimateTotal,
												pStart : c.raw.PlannedStartDate,
												pEnd   : c.raw.PlannedEndDate,
												aEnd   : c.raw.ActualEndDate,
												leaf   : c.raw.Children == undefined || c.raw.Children.length == 0
					                    	});
										});
										Ext.Array.each(children.sort(function(a, b) {
											return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
										}), function(n) {
											node.appendChild(n);
										});
										if (App.down('#rpmTree').getSelectionModel().isSelected(node)) {
											Ext.Array.each(node.childNodes, function(child) {
												App.down('#rpmTree').getSelectionModel().select(child, true);
											});
										}
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
									fetch: ['Children','LeafStoryCount','Name','ObjectID','PortfolioItemTypeName','UnEstimatedLeafStoryCount','LeafStoryCount','LeafStoryPlanEstimateTotal','AcceptedLeafStoryPlanEstimateTotal','PlannedStartDate','PlannedEndDate','ActualEndDate'],
									listeners: {
										load: function(store, data) {
											callback(data);
										}
									}
								});
							}
						},
						itemcollapse : App.viewport.update,
						beforeselect: function(model, record) {
							if (!App.selOverride && record.data.depth == 1) { //Initiative selected, deselect all others
								App.down('#rpmTree').getSelectionModel().deselectAll();
							}
						},
						select: function(model, record) {
							if (record.data.depth == 1) {
								record.cascadeBy(function() {
									App.down('#rpmTree').getSelectionModel().select(this, true);
								});
							} else {
								App.down('#rpmTree').getSelectionModel().select(record.parentNode, true);
							}
						},
						selectionchange: function() {
							clearTimeout(App.rpmTree.updateTimeout);
							App.rpmTree.updateTimeout = setTimeout(App.viewport.update, 500);
						}
					}
				});
			}
		}
	},

	viewport : {
		update : function() {
			var usData  = {};
			var projectsLeft = App.down('#rpmTree').getSelectionModel().getSelection().length;
			
			var pOIDs = [];
			var pAcceptedPoints = {};
			Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection(), function(i) {
				if (i.isVisible()) {
					pOIDs.push(i.raw.id);
					pAcceptedPoints[i.raw.id] = [];
				}
			});
			
			var remaining = App.lbDates.length;
			Ext.Array.each(App.lbDates, function(lbDate, idx) {
				getAcceptedLeafStoryPointsOn(lbDate, function(acceptedLeafStoryPoints) {
					for (p in acceptedLeafStoryPoints) {
						pAcceptedPoints[p][idx] = acceptedLeafStoryPoints[p];
					}
					if (!--remaining) onPoints();
				});
			});

			function onPoints() {
				var velocities = {};
				for (p in pAcceptedPoints) {
					if (pAcceptedPoints[p].length < 2) {
						velocities[p] = 0;
					} else {
						var deltas = [];
						for (var y = 0; y < pAcceptedPoints[p].length - 1; y++) {
							deltas.push(pAcceptedPoints[p][y] - pAcceptedPoints[p][y + 1]);
						}
						velocities[p] = Ext.Array.mean(deltas);
					}
				}

				Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection(), function(i) {
					if (Ext.Array.indexOf(pOIDs, i.raw.id) != -1) {
						var sprintsToComplete = parseFloat(i.raw.peCnt - i.raw.aPeCnt) / velocities[i.raw.id];
						var forecastComp = (i.raw.aEnd) ? i.raw.aEnd + 'x' : (App.iterations[App.currentSprintIndex - Math.floor(sprintsToComplete)]) ? App.iterations[App.currentSprintIndex - Math.floor(sprintsToComplete)].EndDate : null;
						
						var aDate = Rally.util.DateTime.fromIsoString(i.raw.pEnd);
						var bDate = (i.raw.aEnd) ? Rally.util.DateTime.fromIsoString(i.raw.aEnd) : Rally.util.DateTime.fromIsoString(forecastComp);
						var sprintVariance = (aDate && bDate) ? Math.round(Rally.util.DateTime.getDifference(aDate, bDate, 'day') / 21) : null;
						
						usData[i.raw.id] = {
							name              : i.raw.name,
							type              : Ext.Array.indexOf(['Initiative', 'Roll up', 'Feature'], i.raw.type) + ' - ' + i.raw.type,
							estimateRate      : (i.raw.sCnt == 0) ? 0 : parseFloat(1 - (i.raw.ueCnt / i.raw.sCnt)),
							totalPoints       : i.raw.peCnt,
							storyCount        : i.raw.sCnt,
							completeRate      : (i.raw.peCnt == 0) ? 0 : parseFloat(i.raw.aPeCnt / i.raw.peCnt),
							remainingPoints   : parseFloat(i.raw.peCnt - i.raw.aPeCnt),
							avgVelocity       : velocities[i.raw.id],
							sprintsToComplete : sprintsToComplete,
							forecastComp      : forecastComp,
							sprintVariance    : sprintVariance,
							plannedStartDate  : i.raw.pStart,
							plannedEndDate    : i.raw.pEnd
						}
					}
				});
				drawGrid();
			}	
			
			function getAcceptedLeafStoryPointsOn(date, callback) {
				Ext.create('Rally.data.lookback.SnapshotStore', {
					autoLoad : true,
					pageSize : 1000000,
					fetch    : ['ObjectID','AcceptedLeafStoryPlanEstimateTotal'],
					filters  : [{
						property : '__At',
						value    : date
					},{
						property : '_TypeHierarchy',
						value    : 'PortfolioItem'
					},{
						property : 'ObjectID',
						operator : 'in',
						value    : pOIDs
					}],
					listeners : {
						load : function(store, data) {
							var pData = {};
							Ext.Array.each(data, function(p) {
								pData[p.raw.ObjectID] = p.raw.AcceptedLeafStoryPlanEstimateTotal;
							});
							callback(pData);
						}
					}
				});
			}

			function drawGrid() {
				Ext.getBody().unmask();
				var gridArray = [];
				for (s in usData) {
					gridArray.push(usData[s]);
				}
				var fixedColWidth = 110;
				App.down('#viewport').removeAll();
				App.down('#viewport').add({
					xtype             : 'rallygrid',
					id                : 'rally_grid',
					disableSelection  : true,
					showPagingToolbar : false,
					store: Ext.create('Rally.data.custom.Store', {
						data       : gridArray,
						groupField : 'type',
						pageSize   : 1000,
						sorters    : [
							{ property: 'type', direction: 'ASC' },
							{ property: 'name', direction: 'ASC' }
						]
					}),
					features: [Ext.create('Ext.grid.feature.Grouping', {
						groupHeaderTpl: Ext.create('Ext.XTemplate',
						    '{name:this.formatName}',
						    {
						        formatName: function(name) {
						            return name.split(' - ')[1];
						        }
						    }
						)
			   		})],
					columnCfgs: [{
						text      : 'Project Deliverable',
						dataIndex : 'name',
						flex      : 1
					},{
						text      : 'Percent of Backlog Extimated',
						dataIndex : 'estimateRate',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (val == 1) {
								meta.tdCls = 'green';
							} else if (val > .5) {
								meta.tdCls = 'yellow';
							} else {
								meta.tdCls = 'red';
							}
							return Ext.util.Format.number(val * 100, '0,0.0') + '%'
						}
					},{
						text      : 'User Story Count',
						dataIndex : 'storyCount',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,000')
						}
					},{
						text      : 'Total Plan Estimate',
						dataIndex : 'totalPoints',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,000')
						}
					},{
						text      : 'Percent Complete (By Plan Estimate)',
						dataIndex : 'completeRate',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val) {
							return Ext.util.Format.number(val * 100, '0,0.0') + '%'
						}
					},{
						text      : 'Remaining Plan Estimate',
						dataIndex : 'remainingPoints',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,000')
						}
					},{
						text      : 'Average Velocity (By Iteration)',
						dataIndex : 'avgVelocity',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (val == '') {
								meta.tdCls = 'grey';
								return 'N/A';
							} else {
								return Ext.util.Format.number(val, '0,000.0');
							}
						}
					},{
						text      : 'Iterations Required for Completion',
						dataIndex : 'sprintsToComplete',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (!isFinite(val)) {
								meta.tdCls = 'grey';
								return 'N/A';
							} else {
								return Ext.util.Format.number(val, '0,000.0');
							}
						}
					},{
						text      : 'Planned Start Date',
						dataIndex : 'plannedStartDate',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (val == null) {
								meta.tdCls = 'grey';
								return 'N/A'
							} else {
								return val.substring(0,10)
							}
						}
					},{
						text      : 'Forecasted Completion Date',
						dataIndex : 'forecastComp',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (val == '0NaN-NaN-NaNTNaN:NaN:NaN+NaN:NaN' || val == null) {
								meta.tdCls = 'grey';
								return 'N/A'
							} else if (val.match(/x/)) {
								meta.tdCls = 'green';
								return val.replace('x','').substring(0,10);
							} else {
								return val.substring(0,10)
							}
						}
					},{
						text      : 'Planned End Date',
						dataIndex : 'plannedEndDate',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (val == null) {
								meta.tdCls = 'grey';
								return 'N/A'
							} else {
								return val.substring(0,10)
							}
						}
					},{
						text      : 'Completion Iteration Variance',
						dataIndex : 'sprintVariance',
						width     : fixedColWidth,
						align     : 'center',
						resizable : false,
						renderer  : function(val, meta) {
							if (val === null || !isFinite(val)) {
								meta.tdCls = 'grey';
								return 'N/A';
							} else if (val >= 0) {
								meta.tdCls = 'green';
								return (val == 0) ? val : '+' + val;
							} else {
								meta.tdCls = 'red';
								return val;
							}
						}
					}]
				});
			}	
		}
	}
});