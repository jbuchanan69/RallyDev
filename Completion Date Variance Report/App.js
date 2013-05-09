// Completion Date Variance Report - Version 0.3
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
			id: 'help',
			handler: function(){
				Ext.create('Rally.ui.dialog.Dialog', {
					autoShow  : true,
					closable  : true,
					draggable : true,
					width     : 500,
					title     : 'Completion Date Variance Report - Help',
					items     : {
						xtype: 'component',
						html: "                                                                                         \
							<table class='helpTable' width='100%' border='1'>                                           \
								<tr>                                                                                    \
									<td><i>Italic Date:</i></td>                                                        \
									<td>Iterations have not been planned out far enough to align the forecasted end     \
									    date with an official sprint. Instead, an average sprint length of three weeks  \
									    has been used to estimate the completion date.                                  \
									</td>                                                                               \
								<tr>                                                                                    \
								<tr>                                                                                    \
									<td><b>Bold Date:</b></td>                                                          \
									<td>A child RPM element to has a forecasted completion date that is further in the  \
									    future than the current forecasted completion date of the parent element. Since \
									    the parent element cannot be considered completed until all children have been  \
									    completed, the forecasted completion date has been pushed out to reflect that   \
									    of the child element.                                                           \
									</td>                                                                               \
								<tr>                                                                                    \
								<tr>                                                                                    \
									<td class='green'><div class='x-grid-cell-inner'>Green Date</div></td>              \
									<td>This RPM element has been assigned an 'Actual Completed Date'. The forecasted   \
									completion date has been replaced by the element's actual completion date.          \
									</td>                                                                               \
								<tr>                                                                                    \
							</table>                                                                                    \
						",
						padding: 10
					}
				});
			}
		},{
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
	                        	excel_data += line.replace(/[^\011\012\015\040-\177]/g, '>>');
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
			hidden    : true,
			xtype     : 'rallyiterationcombobox',
			id        : 'iterPicker',
			listeners : {
				ready: function() {
					Ext.onReady(function() {
						App.velocityLookbackDates = [];
						App.currentIterationIdx   = 0;
						Ext.Array.each(App.down('#iterPicker').store.data.items, function(n, k) {
							if (n.raw.Name == App.down('#iterPicker').getRawValue()) App.currentIterationIdx = k;
						});
						for (var i = 0; i < 6; i++) {
							App.velocityLookbackDates.push(App.down('#iterPicker').store.data.items[App.currentIterationIdx + i].raw.StartDate);
						}
					});
				}
			}
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
		App.viewableTeams = [];
		var loader = Ext.create('Rally.data.WsapiDataStore', {
			model     : 'Project',
			fetch     : ['ObjectID'],
			listeners : {
				load : function(store, data) {
					if (data && data.length) {
						Ext.Array.each(data, function(i) {
							App.viewableTeams.push(i.raw.ObjectID);
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
			Ext.getBody().mask('Loading');
			var nodeObj   = {};
			var nodeArray = [];
			Ext.create('Rally.data.lookback.SnapshotStore', {
				autoLoad : true,
				pageSize : 1000000,
				fetch    : [
					'ActualEndDate',
					'AcceptedLeafStoryCount',
					'AcceptedLeafStoryPlanEstimateTotal',
					'LeafStoryCount',
					'LeafStoryPlanEstimateTotal',
					'Name',
					'ObjectID',
					'Parent',
					'PercentDoneByStoryPlanEstimate',
					'PlannedEndDate',
					'PlannedStartDate',
					'PortfolioItemType',
					'UnEstimatedLeafStoryCount',
					'_UnformattedID'
				],
				filters  : [{
					property : '__At',
					value    : 'current'
				},{
					property : '_TypeHierarchy',
					value    : 'PortfolioItem'
				},{
					property : '_ItemHierarchy',
					value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
				}],
				listeners : {
					load : function(store, data, success) {
						Ext.Array.each(data, function(i) {
							i.raw.PortfolioItemTypeName = (i.raw.PortfolioItemType == 4628560775) ? '2 - Feature'    :
														  (i.raw.PortfolioItemType == 4628560776) ? '1 - Rollup'     :
														  (i.raw.PortfolioItemType == 4628560777) ? '0 - Initiative' : 'N/A';
							i.raw.LeafStoryRemainingPlanEstimateTotal = i.raw.LeafStoryPlanEstimateTotal - i.raw.AcceptedLeafStoryPlanEstimateTotal;
							i.raw.BacklogEstimatedRate                = (i.raw.LeafStoryCount > 0 && i.raw.UnEstimatedLeafStoryCount == i.raw.LeafStoryCount) ? 0.0 : parseFloat(1 - (i.raw.UnEstimatedLeafStoryCount / i.raw.LeafStoryCount)) || -1;
							i.raw.AcceptedScopeTrend                  = [];

							nodeObj[i.raw.ObjectID]                   = i.raw;
						});
						getVolocities();
					}
				}
			});
		
			function getVolocities() {
				var acceptedScopes = [];
				var remaining = 0;
				Ext.Array.each(App.velocityLookbackDates, function(date, k) {
					remaining++;
					getAcceptedScopeOn(date, k, function() {
						if (!--remaining) {
							for (n in nodeObj) {
								if (nodeObj[n].ActualEndDate) {
									nodeObj[n].Velocity = 0;
									nodeObj[n].RemainingIterations = 0;
									nodeObj[n].ForecastedCompletionDate = nodeObj[n].ActualEndDate + 'A';
								} else {
									var diffs = [];
									for (var i = 0; i < nodeObj[n].AcceptedScopeTrend.length - 1; i++) {
										diffs.push(nodeObj[n].AcceptedScopeTrend[i] - nodeObj[n].AcceptedScopeTrend[i + 1]);
									}
									if (diffs.length > 0 && Ext.Array.mean(diffs) > 0) {
										nodeObj[n].Velocity = Ext.Array.mean(diffs);
										nodeObj[n].RemainingIterations = Math.ceil(nodeObj[n].LeafStoryRemainingPlanEstimateTotal / nodeObj[n].Velocity);
										if (App.down('#iterPicker').store.data.items[App.currentIterationIdx - nodeObj[n].RemainingIterations + 1] != undefined) {
											nodeObj[n].ForecastedCompletionDate = App.down('#iterPicker').store.data.items[App.currentIterationIdx - nodeObj[n].RemainingIterations + 1].raw.EndDate.substring(0,10);
										} else { //Iterations not assigned for forecasted date, use current iteration end date, plus 3 weeks per estimated sprint
											nodeObj[n].ForecastedCompletionDate = Rally.util.DateTime.toIsoString(Ext.Date.add(Rally.util.DateTime.fromIsoString(App.down('#iterPicker').store.data.items[App.currentIterationIdx].raw.EndDate), Ext.Date.DAY, 21 * Math.floor(nodeObj[n].RemainingIterations))).substring(0,10) + 'I';
										}
									} else {
										nodeObj[n].Velocity = 0;
										nodeObj[n].RemainingIterations = -1;
										nodeObj[n].ForecastedCompletionDate = 'N/A';
									}
								}
							}
							//Push "long pull" dates to their parents
							for (n in nodeObj) {
								//Push up Rollup -> Initiative and Feature -> Rollup
								if (nodeObj[n].ForecastedCompletionDate        != 'N/A'     &&
									nodeObj[nodeObj[n].Parent]                 != undefined &&
									nodeObj[nodeObj[n].Parent].ForecastedCompletionDate < nodeObj[n].ForecastedCompletionDate) {
										nodeObj[nodeObj[n].Parent].ForecastedCompletionDate = nodeObj[n].ForecastedCompletionDate + 'B';
										nodeObj[nodeObj[n].Parent].RemainingIterations      = nodeObj[n].RemainingIterations;
								}
								//Push up Feature -> Initiative
								if (nodeObj[n].ForecastedCompletionDate        != 'N/A'     &&
									nodeObj[nodeObj[n].Parent]                 != undefined &&
									nodeObj[nodeObj[nodeObj[n].Parent].Parent] != undefined &&
									nodeObj[nodeObj[nodeObj[n].Parent].Parent].ForecastedCompletionDate < nodeObj[n].ForecastedCompletionDate) {
										nodeObj[nodeObj[nodeObj[n].Parent].Parent].ForecastedCompletionDate = nodeObj[n].ForecastedCompletionDate + 'B';
										nodeObj[nodeObj[nodeObj[n].Parent].Parent].RemainingIterations      = nodeObj[n].RemainingIterations;
								}
							}
							for (n in nodeObj) {
								var aDate = Rally.util.DateTime.fromIsoString(nodeObj[n].PlannedEndDate);
								var bDate = Rally.util.DateTime.fromIsoString(nodeObj[n].ForecastedCompletionDate.replace(/(B|I|A)/g,''));
								nodeObj[n].CompletionIterationVariance = (aDate && bDate) ? Math.round(Rally.util.DateTime.getDifference(aDate, bDate, 'day') / 21) : -1000000;
								nodeArray.push(nodeObj[n]);
							}
							drawGrid();	
						}
					});
				});
				
				function getAcceptedScopeOn(date, idx, callback) {
					Ext.create('Rally.data.lookback.SnapshotStore', {
						autoLoad : true,
						pageSize : 1000000,
						fetch    : ['ObjectID','AcceptedLeafStoryPlanEstimateTotal'],
						filters  : [{
							property : '__At',
							value    : Rally.util.DateTime.toIsoString(Rally.util.DateTime.fromIsoString(date))
						},{
							property : '_TypeHierarchy',
							value    : 'PortfolioItem'
						},{
							property : '_ItemHierarchy',
							value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
						}],
						listeners : {
							load : function(store, data, success) {
								Ext.Array.each(data, function(i) {
									if (nodeObj[i.raw.ObjectID])
										nodeObj[i.raw.ObjectID].AcceptedScopeTrend[idx] = i.raw.AcceptedLeafStoryPlanEstimateTotal;
								});
								callback();
							}
						}
					});
				}

			}

			function drawGrid() {
				Ext.getBody().unmask();
				App.down('#viewport').removeAll();
				App.down('#viewport').add({
					xtype             : 'rallygrid',
					id                : 'viewport_grid',
					disableSelection  : true,
					showPagingToolbar : false,
					store             : Ext.create('Rally.data.custom.Store', {
						data       : nodeArray,
						groupField : 'PortfolioItemTypeName',
						pageSize   : 1000000,
						sorters    : [{
							property  : 'PortfolioItemTypeName',
							direction : 'ASC'
						},{
							property  : 'ForecastedCompletionDate',
							direction : 'ASC'
						}]
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
					columnCfgs : [{
						text      : 'ID',
						dataIndex : '_UnformattedID',
						width     : 55,
						align     : 'right',
						renderer  : function(val, meta, record) {
							switch (record.get('PortfolioItemTypeName')) {
								case '0 - Initiative' : return '<a href="https://rally1.rallydev.com/#/detail/portfolioitem/initiative/' + record.get('ObjectID') + '">I' + val + '</a>'; break;
								case '1 - Rollup'     : return '<a href="https://rally1.rallydev.com/#/detail/portfolioitem/rollup/'     + record.get('ObjectID') + '">R' + val + '</a>'; break;
							    case '2 - Feature'    : return '<a href="https://rally1.rallydev.com/#/detail/portfolioitem/feature/'    + record.get('ObjectID') + '">F' + val + '</a>'; break;
							    default               : return '';                                                                                                                        break;
							}
						}
					},{
						text      : 'Name',
						dataIndex : 'Name',
						flex      : 1,
						minWidth  : 110
					},{
						text      : 'Percent of Backlog Estimated',
						dataIndex : 'BacklogEstimatedRate',
						width     : 110,
						align     : 'center',
						renderer  : function(val, meta) {
							if (val == -1) {
								meta.tdCls = 'grey';
								return 'N/A';
							} else {
								(val == 1) ? meta.tdCls = 'green' : (val > .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
								return Ext.util.Format.number(val * 100, '0,0.0') + '%';
							}
						}
					},{
						text      : 'User Story Count',
						dataIndex : 'LeafStoryCount',
						width     : 110,
						align     : 'center',
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,0');
						}
					},{
						text      : 'Total Plan Estimate',
						dataIndex : 'LeafStoryPlanEstimateTotal',
						width     : 110,
						align     : 'center',
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,0');
						}
					},{
						text      : 'Percent Complete (By Plan Estimate)',
						dataIndex : 'PercentDoneByStoryPlanEstimate',
						width     : 110,
						align     : 'center',
						renderer  : function(val) {
							return Ext.util.Format.number(val * 100, '0,0.0') + '%';
						}
					},{
						text      : 'Remaining Plan Estimate',
						dataIndex : 'LeafStoryRemainingPlanEstimateTotal',
						width     : 110,
						align     : 'center',
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,0');
						}
					},{
						text      : 'Average Velocity (By Iteration)',
						dataIndex : 'Velocity',
						width     : 110,
						align     : 'center',
						renderer  : function(val) {
							return Ext.util.Format.number(val, '0,0.0');
						}
					},{
						text      : 'Planned Start Date',
						dataIndex : 'PlannedStartDate',
						width     : 110,
						align     : 'center',
						renderer  : function(val, meta) {
							if (!val) {
								meta.tdCls = 'grey';
								return 'N/A';
							} else {
								return val.substring(0,10);
							}
						}
					},{
						text      : 'Planned End Date',
						dataIndex : 'PlannedEndDate',
						width     : 110,
						align     : 'center',
						renderer  : function(val, meta) {
							if (!val) {
								meta.tdCls = 'grey';
								return 'N/A';
							} else {
								return val.substring(0,10);
							}
						}
					},{
						text      : 'Forecasted Completion Date',
						dataIndex : 'ForecastedCompletionDate',
						width     : 110,
						align     : 'center',
						renderer  : function(val, meta) {
							if (val == 'N/A') {
								meta.tdCls = 'grey';
								return val;
							} else if (val.match(/A/)) {
								meta.tdCls = 'green';
								return (val.match(/B/) ? '<b>' : '') + (val.match(/I/) ? '<i>' : '') + val.substring(0,10) + (val.match(/B/) ? '</b>' : '') + (val.match(/I/) ? '</i>' : '');
							} else {
								return (val.match(/B/) ? '<b>' : '') + (val.match(/I/) ? '<i>' : '') + val.substring(0,10) + (val.match(/B/) ? '</b>' : '') + (val.match(/I/) ? '</i>' : '');
							}
						}
					},{
						text      : 'Iterations Required for Completion',
						dataIndex : 'RemainingIterations',
						width     : 110,
						align     : 'center',
						renderer  : function(val, meta) {
							if (val == -1) {
								meta.tdCls = 'grey';
								return 'N/A';
							} else {
								return val;
							}
						}
					},{
						text      : 'Completion Iteration Variance',
						dataIndex : 'CompletionIterationVariance',
						width     : 110,
						align     : 'center',
						renderer  : function(val, meta) {
							if (val == -1000000) {
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