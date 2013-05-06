// RPM Heat Map - Version 3.0.3
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
					width     : 300,
					title     : 'RPM Heat Map - Help',
					items     : {
						xtype: 'component',
						html: '                                                                                        \
							<div><b>% Accepted:</b></div>                                                              \
							<table width="277">                                                                        \
								<tr>                                                                                   \
									<td width="33%" class="green"><div class="x-grid-cell-inner">100%</div></td>       \
									<td width="33%" class="yellow"><div class="x-grid-cell-inner">50% - 99%</div></td> \
									<td width="33%" class="red"><div class="x-grid-cell-inner">&lt50%</div></td>       \
								</tr>                                                                                  \
							</table>                                                                                   \
							<div><b>Defects / Blocks:</b></div>                                                        \
							<table width="277">                                                                        \
								<tr>                                                                                   \
									<td width="33%" class="green"><div class="x-grid-cell-inner">0</div></td>          \
									<td width="33%" class="yellow"><div class="x-grid-cell-inner">1</div></td>         \
									<td width="33%" class="red"><div class="x-grid-cell-inner">2+</div></td>           \
								</tr>                                                                                  \
							</table>                                                                                   \
							<div><b>Scope Change:</b></div>                                                            \
							<table width="277">                                                                        \
								<tr>                                                                                   \
									<td width="33%" class="green"><div class="x-grid-cell-inner">0%-10%</div></td>     \
									<td width="33%" class="yellow"><div class="x-grid-cell-inner">10%-25%</div></td>   \
									<td width="33%" class="red"><div class="x-grid-cell-inner">&gt25%</div></td>       \
								</tr>                                                                                  \
							</table>                                                                                   \
						',
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
	                        	excel_data += line.replace(/[^\011\012\015\040-\177]/g, '>>').replace(/\//g, 'vs');
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
			defaults : {
				width      : 270,
				margins    : '3 0 0 0'
			},
			items   : [{
				xtype      : 'rallyiterationcombobox',
				id         : 'aIter',
				listeners  : {
					change : function() {
						Ext.onReady(function() {
							if (App.down('#rpmTree').getSelectionModel().getSelection().length > 0) App.viewport.update();
						});
					}
				}
			},{
				xtype      : 'rallyiterationcombobox',
				id         : 'bIter',
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
		},{
			id      : 'settingsPanel2',
			layout  : 'vbox',
			height  : 30,
			border  : 0,
			padding : 5,
			style   : {
				borderTop: '1px solid #99BCE8'
			},
			items: [{
				xtype      : 'checkbox',
				id         : 'queryTypePicker',
				fieldLabel : 'Multi-Iteration Range',
				labelWidth : 165,
				labelAlign : 'right',
				width      : 290,
				listeners  : {
					change : function() {
						Ext.onReady(function() {
                			if (App.down('#queryTypePicker').getValue() == false) {
                				App.down('#settingsPanel').setHeight(38);
                				App.down('#aIter').setValue(App.down('#bIter').getValue());
                			} else {
                				App.down('#settingsPanel').setHeight(70);
                				App.down('#bIter').setValue(App.down('#aIter').getValue());
                				var items = App.down('#aIter').store.data.items;
								for (i in items) {
						    		if (App.down('#aIter').getValue() == items[i].data._ref) {
						    			if (i < items.length - 2)
						    				App.down('#aIter').setValue(items[parseInt(i) + 2].data._ref);
						    			else
						    				App.down('#aIter').setValue(items[parseInt(items.length - 1)]);
						    			return;
						    		}
						    	}
                			}
                		});
					}
				}
			}]
		}]
	},{
		id          : 'viewport',
		collapsible : false,
		region      : 'center',
		margins     : '5 0 0 0'
	}],

    launch: function() {
    	App = this;
    	App.iterNameHash = {};
    	App.teamNameHash = {};
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
		}()
	},

	viewport: {
		update: function() {
			App.updateTimeout = setTimeout(function() {
				Ext.getBody().unmask();
				App.down('#viewport').removeAll();
				Ext.Msg.alert('Error', 'Query timed out. Possibly the result of misconfigured permissions.');
			}, 10000);
			Ext.getBody().mask('Loading');
			App.viewport.teamData = {};
			App.viewport.getIterOIDs(function() {
				var aDate = Ext.Date.add(App.down('#aIter').getRecord().get('StartDate'), Ext.Date.DAY, 2);
				var bDate = (App.down('#queryTypePicker').getValue() == true) ? App.down('#bIter').getRecord().get('EndDate') : App.down('#aIter').getRecord().get('EndDate');
			
				App.viewport.getDataOn(aDate, true, function() {
					App.viewport.getDataOn(bDate, false, function() {
						App.viewport.getDefectDetail(bDate, App.viewport.drawGrid);
					});
				});

			});
		},

		getIterOIDs: function(callback) {
			App.viewport.iterOIDs   = [];
			App.viewport.defectOIDs = [];
			var filters  = [];
			if (App.down('#queryTypePicker').getValue() == true) {
				filters.push({
					property : 'StartDate',
					operator : '>=',
					value    : Rally.util.DateTime.toIsoString(App.down('#aIter').getRecord().get('StartDate'))
				});
				filters.push({
					property : 'EndDate',
					operator : '<=',
					value    : Rally.util.DateTime.toIsoString(App.down('#bIter').getRecord().get('EndDate'))
				});
			} else {
				filters.push({
					property : 'Name',
					value    : App.down('#aIter').getRawValue()
				});
			}
			var loader = Ext.create('Rally.data.WsapiDataStore', {
				model     : 'Iteration',
				fetch     : ['ObjectID','Name','Project'],
				filters   : filters,
				listeners : {
					load : function(store, data) {
						if (data && data.length) {
							Ext.Array.each(data, function(i) {
								App.viewport.iterOIDs.push(i.raw.ObjectID);
								App.iterNameHash[i.raw.ObjectID] = i.raw.Name;
								App.teamNameHash[i.raw.Project.ObjectID] = i.raw.Project.Name;
							});
							loader.nextPage();
						} else {
							callback();
						}
					}
				}
			});
			loader.loadPage(1);
		},

		getDataOn: function(date, initial, callback) {
			Ext.create('Rally.data.lookback.SnapshotStore', {
				autoLoad : true,
				pageSize : 1000000,
				fetch    : [
					'Name',
					'Project',
					'Iteration',
					'ScheduleState',
					'PlanEstimate',
					'Defects',
					'Blocked',
					'TaskActualTotal',
					'TaskEstimateTotal',
					'TaskRemainingTotal',
					'_UnformattedID',
					'BlockedReason'
				],
				hydrate  : ['ScheduleState'],
				filters  : [{
					property : '__At',
					value    : Rally.util.DateTime.toIsoString(date)
				},{
					property : '_TypeHierarchy',
					value    : 'HierarchicalRequirement'
				},{
					property : '_ItemHierarchy',
					value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
				},{
					property : 'Children',
					value    : null
				},{
					property : 'Iteration',
					operator : '!=',
					value    : null
				}],
				listeners : {
					load : function(store, data, success) {
						Ext.Array.each(data, function(i) {
							if (Ext.Array.indexOf(App.viewport.iterOIDs, i.raw.Iteration) != -1) { //User Story falls in selected iteration range
								if (App.viewport.teamData[i.raw.Project] === undefined)
									App.viewport.teamData[i.raw.Project] = {
										teamName           : App.teamNameHash[i.raw.Project],
										storyCount         : 0,
										acptStoryCount     : 0,
										initStoryScope     : 0,
										storyScope         : 0,
										acptStoryScope     : 0,
										openDefectCount    : 0,
										taskActualTotal    : 0,
										taskEstimateTotal  : 0,
										taskRemainingTotal : 0,
										blockCount         : 0,
										blockedStories     : [],
										openDefects        : [],
										defectOIDs         : [],
										initialStories     : [],
										finalStories       : []
									};
								if (initial) {
									App.viewport.teamData[i.raw.Project].initStoryScope += parseFloat(i.raw.PlanEstimate) || 0.0;
									App.viewport.teamData[i.raw.Project].initialStories.push(i.raw);
								} else {
									if (i.raw.ScheduleState == 'Accepted') {
										App.viewport.teamData[i.raw.Project].acptStoryCount++;
										App.viewport.teamData[i.raw.Project].acptStoryScope += parseFloat(i.raw.PlanEstimate) || 0.0;
									}
									if (i.raw.Blocked) {
										App.viewport.teamData[i.raw.Project].blockCount++;
										App.viewport.teamData[i.raw.Project].blockedStories.push(i.raw);
									}
									Ext.Array.each(i.raw.Defects, function(OID) {
										App.viewport.defectOIDs.push(OID);
									});
									App.viewport.teamData[i.raw.Project].storyCount++;
									App.viewport.teamData[i.raw.Project].storyScope         += parseFloat(i.raw.PlanEstimate)       || 0.0;
									App.viewport.teamData[i.raw.Project].taskActualTotal    += parseFloat(i.raw.TaskActualTotal)    || 0.0;
									App.viewport.teamData[i.raw.Project].taskEstimateTotal  += parseFloat(i.raw.TaskEstimateTotal)  || 0.0;
									App.viewport.teamData[i.raw.Project].taskRemainingTotal += parseFloat(i.raw.TaskRemainingTotal) || 0.0;
									App.viewport.teamData[i.raw.Project].finalStories.push(i.raw);
								}
							}
						});
						callback();
					}
				}
			});
		},

		getDefectDetail: function(date, callback) {
			Ext.create('Rally.data.lookback.SnapshotStore', {
				autoLoad : true,
				pageSize : 1000000,
				fetch    : ['Project','State','_UnformattedID','Name','Priority','Severity','BlockedReason'],
				hydrate  : ['State','Priority','Severity'],
				filters  : [{
					property : '__At',
					value    : Rally.util.DateTime.toIsoString(date)
				},{
					property : '_TypeHierarchy',
					value    : 'Defect'
				},{
					property : 'ObjectID',
					operator : 'in',
					value    : App.viewport.defectOIDs
				}],
				listeners : {
					load : function(store, data, success) {
						Ext.Array.each(data, function(i) {
							if (i.raw.State != 'Closed' && i.raw.State != 'Fixed') {
								App.viewport.teamData[i.raw.Project].openDefectCount++;
								App.viewport.teamData[i.raw.Project].openDefects.push(i.raw);
							}
						});
						callback();
					}
				}
			});
		},

		drawGrid: function() {
			clearTimeout(App.updateTimeout);
			Ext.getBody().unmask();
			var gridArray = [];
			var node;
			for (i in App.viewport.teamData) {
				node = App.viewport.teamData[i];
				node.acptStoryCountRate   = parseFloat(node.acptStoryCount / node.storyCount) || 0;
				node.acptStoryScopeRate   = parseFloat(node.acptStoryScope / node.storyScope) || 0;
				node.actualVsEstimateRate = (node.taskEstimateTotal == 0) ? 'N/A' : parseFloat((node.taskActualTotal / node.taskEstimateTotal) - 1) || 0;
				node.scopeChangeRate      = (node.initStoryScope == 0) ? 'N/A' : parseFloat((node.storyScope / node.initStoryScope) - 1) || 0;
				node.color                = (node.acptStoryCountRate == 1    &&
											 node.acptStoryScopeRate == 1    &&
											 node.scopeChangeRate    <= .1   &&
											 node.scopeChangeRate    >= -.1  &&
											 node.blockCount         == 0    &&
											 node.openDefectCount    == 0) ? 0 : (
											 node.acptStoryCountRate >= .5   &&
											 node.acptStoryScopeRate >= .5   &&
											 node.scopeChangeRate    <= .25  &&
											 node.scopeChangeRate    >= -.25 &&
											 node.blockCount         <= 1    &&
											 node.openDefectCount    <= 1) ? 1 : 2;
				gridArray.push(node);
			}
			App.down('#viewport').removeAll();
			App.down('#viewport').add({
				xtype             : 'rallygrid',
				id                : 'viewport_grid',
				disableSelection  : true,
				showPagingToolbar : false,
				store             : Ext.create('Rally.data.custom.Store', {
					data       : gridArray,
					pageSize   : 1000000,
					sorters    : [{
						property  : 'teamName',
						direction : 'ASC'
					}]
				}),
				features: [{
					ftype: 'summary'
				}],
				columnCfgs : [{
					text        : 'Team',
					dataIndex   : 'teamName',
					flex        : 1,
					minWidth    : 190,
					summaryType : function() {
					return '<div class="qSummary">' + App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.name + '<br />' + App.down('#aIter').getRawValue() + ((App.down('#queryTypePicker').getValue() == true) ? '<br />' + App.down('#bIter').getRawValue() : '') + '</div>';
				}
				},{
					text      : '',
					dataIndex : 'color',
					width     : 27,
					renderer  : function(val, meta) {
						(val == 0) ? meta.tdCls = 'green' : (val == 1) ? meta.tdCls = 'yellow' : meta.tdCls = 'red'; 
						return '';
					}
				},{
					text      : 'Extimated vs Actual Hours',
					dataIndex : 'actualVsEstimateRate',
					width     : 160,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val, meta, record) {
						return '<div class="half">' + ((val == 'N/A') ? val : (((val > 0) ? '+' : '') + parseInt(val * 100) + '%')) + '</div><div class="half">' + Ext.util.Format.number(record.get('taskEstimateTotal'), '0,0') + ' / ' + Ext.util.Format.number(record.get('taskActualTotal'), '0,0') + '</div>';
					}
				},{
					text      : 'Remaining Hours',
					dataIndex : 'taskRemainingTotal',
					width     : 80,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val) {
						return Ext.util.Format.number(val, '0,0');
					}
				},{
					text      : 'Accepted Story Count',
					dataIndex : 'acptStoryCountRate',
					width     : 160,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val, meta, record) {
						(val == 1) ? meta.tdCls = 'green' : (val >= .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return '<div class="half">' + parseInt(val * 100) + '%</div><div class="half">' + record.get('acptStoryCount') + ' of ' + record.get('storyCount') + '</div>';
					}
				},{
					text      : 'Accepted Story Scope',
					dataIndex : 'acptStoryScopeRate',
					width     : 160,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val, meta, record) {
						(val == 1) ? meta.tdCls = 'green' : (val >= .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return '<div class="half">' + parseInt(val * 100) + '%</div><div class="half">' + record.get('acptStoryCount') + ' of ' + record.get('storyCount') + '</div>';
					}
				},{
					text      : 'Blocks',
					dataIndex : 'blockCount',
					width     : 80,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val, meta, record) {
						(val == 0) ? meta.tdCls = 'green' : (val == 1) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return '<div class="half">' + val + '</div>';
					}
				},{
					text      : 'Open Defects',
					dataIndex : 'openDefectCount',
					width     : 80,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val, meta, record) {
						(val == 0) ? meta.tdCls = 'green' : (val == 1) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return '<div class="half">' + val + '</div>';
					}
				},{
					text      : 'Scope Change',
					dataIndex : 'scopeChangeRate',
					width     : 160,
					minWidth  : 80,
					align     : 'center',
					renderer  : function(val, meta, record) {
						(val <= .1 && val >= -.1) ? meta.tdCls = 'green' : (val <= .25 && val >= -.25) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return '<div class="half">' + ((val == 'N/A') ? val : (((val > 0) ? '+' : '') + Ext.util.Format.number(val * 100, '0,0') + '%')) + '</div><div class="half">' + record.get('initStoryScope') + ' &rArr; ' + record.get('storyScope') + '</div>';
					}
				}],
				listeners: {
					itemclick: function(view, record, item, index, evt) {
						var column = view.getPositionByEvent(evt).column;
						if (column == 6) { //Blocks Report
							if (record.get('blockedStories').length == 0) return;
							App.popup = Ext.create('Rally.ui.dialog.Dialog', {
								autoShow    : true,
								width       : Ext.getBody().getWidth(),
								height      : Ext.getBody().getHeight(),
								autoScroll  : true,
								closable    : true,
								title       : record.get('teamName') + ' - Blocks',
								items: [{
									xtype             : 'rallygrid',
									layout            : 'fit',
									showPagingToolbar : false,
									disableSelection  : true,
									columnCfgs        : [
										{ text: 'ID',              dataIndex: '_UnformattedID', width: 60, renderer: function(val) { return 'US' + val; } },
										{ text: 'Name',            dataIndex: 'Name',           flex: 1                                                   },
										{ text: 'Blocking Reason', dataIndex: 'BlockedReason',  flex: 1,                                                  },
										{ text: 'Plan Estimate',   dataIndex: 'PlanEstimate',   width: 60,  align: 'center'                               },
										{ text: 'State',           dataIndex: 'ScheduleState',  width: 125, align: 'center'                               }
									],
									store : Ext.create('Rally.data.custom.Store', {
										data     : record.get('blockedStories'),
										fields   : ['_UnformattedID','Name','ScheduleState','BlockedReason','PlanEstimate'],
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
						} else if (column == 7) { // Defects Report
							if (record.get('openDefects').length == 0) return;
							App.popup = Ext.create('Rally.ui.dialog.Dialog', {
								autoShow    : true,
								width       : Ext.getBody().getWidth(),
								height      : Ext.getBody().getHeight(),
								autoScroll  : true,
								closable    : true,
								title       : record.get('teamName') + ' - Defects',
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
										data     : record.get('openDefects'),
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
							//Set color based on presence in initial and final scope
							//0 == 'Green'
							//1 == 'Red'
							//2 == 'Yellow'
							Ext.Array.each(record.get('initialStories'), function(s) {
								switch (cmpFn(s, record.get('finalStories'))) {
									case -1 : s.color = 1;  break;
									case 0  : s.color = 2;  break;
									default : s.color = -1; break;
								}
							});
							// // Mark stories in the final scope but not in the initial scope as green
							Ext.Array.each(record.get('finalStories'), function(s) {
								switch (cmpFn(s, record.get('initialStories'))) {
									case -1 : s.color = 0;  break;
									case 0  : s.color = 2;  break;
									default : s.color = -1; break;
								}
							});

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
								title : record.get('teamName') + ' - Scope Change Report',
								defaults : {
									xtype  : 'rallygrid',
									width  : '49.9%',
									style             : { border : '1px solid #99BCE8' },
									showPagingToolbar : false,
									disableSelection  : true,
									columnCfgs        : [{
										text      : '',
										dataIndex : 'color',
										width     : 27,
										align     : 'center',
										renderer  : function(val, meta, record) {
											(val == 0) ? meta.tdCls = 'green' : (val == 1) ? meta.tdCls = 'red' : (val == 2) ? meta.tdCls = 'yellow' : null;
											return (val == 0) ? '+' : (val == 1) ? '-' : (val == 2) ? 'C' : '';
										}
									},{
										text      : 'ID',
										dataIndex : '_UnformattedID',
										width     : 60,
										renderer  : function(val) {
											return 'US' + val;
										}
									},{
										text      : 'Name',
										dataIndex : 'Name',
										flex      : 1
									},{
										text      : 'Plan Estimate',
										dataIndex : 'PlanEstimate',
										width     : 60,
										align     : 'center'
									},{
										text      : 'State',
										dataIndex : 'ScheduleState',
										width     : 90,
										align     : 'center'
									}]
								},
								items: [{
									store : Ext.create('Rally.data.custom.Store', {
										data     : record.get('initialStories'),
										fields   : ['color','_UnformattedID','Name','PlanEstimate','ScheduleState'],
										sorters  : [
											{ property: 'color',          direction: 'DESC' },
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
										data     : record.get('finalStories'),
										sorters  : [
											{ property: 'color',          direction: 'DESC' },
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
					
						function cmpFn(item, cmpStore) {
							for (s in cmpStore) {
								if (cmpStore[s].ObjectID == item.ObjectID) {                     // Items exists in both stores
									if (cmpStore[s].PlanEstimate != item.PlanEstimate) return 0; // Points value has changed
									else return 1;                                               // No changes have been made
								}
							}
							return -1;                                                           // Item not in other store
						}

					}
				}
			});
		}
	}
});