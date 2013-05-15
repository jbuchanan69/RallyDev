// Cross Workspace Testing Status Dashboard - Version 2.3
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

	items: [{
		xtype  : 'container',
		id     : 'toolbar',
		layout : 'hbox',
		items  : [{
			xtype  : 'container',
			flex   : 1,
			layout : 'hbox',
			items  : [{
				xtype          : 'combo',
				fieldLabel     : 'Filter',
				id             : 'filterPicker',
				width          : 100,
				labelWidth     : 25,
				editable       : false,
				forceSelection : true,
				queryMode      : 'local',
				displayField   : 'text',
				valueField     : 'text',
				value          : 'Iteration',
				store          : {
                    fields: ['text'],
                    data: [
                    	{ text: 'Iteration' },
                    	{ text: 'Release'   }
                    ]
                },
                listeners: {
                	change: function() {
                		Ext.onReady(function() {
                			if (App.down('#filterPicker').getValue() == 'Release') {
                				App.down('#releasePicker').show();
                				App.down('#iterPicker').hide();
                			} else {
                				App.down('#releasePicker').hide();
                				App.down('#iterPicker').show();
                			}
                			App.viewport.update(App.viewport.showStats);
                		});
                	}
                }
			},{
				xtype     : 'rallyiterationcombobox',
				id        : 'iterPicker',
				listeners : {
					change : function() {
						Ext.onReady(function() {
							App.viewport.update(App.viewport.showStats);
						});
					},
					ready : function() {
						Ext.onReady(function() {
							App.viewport.update(App.viewport.showStats);
						});
					}
				}
			},{
				xtype     : 'rallyreleasecombobox',
				id        : 'releasePicker',
				hidden    : true,
				listeners : {
					change : function() {
						Ext.onReady(function() {
							App.viewport.update(App.viewport.showStats);
						});
					}
				}
			},{
				xtype      : 'rallymultiobjectpicker',
				id         : 'tagPicker',
				modelType  : 'Tag',
				fieldLabel : 'Tags:',
				labelWidth : 25,
				width      : 200,
				margins    : '0 0 0 15',
				listeners  : {
                    blur: function() {
                        this.collapse();
                    },
                    focus: function() {
                    	this.expand();
                    },
                    selectionchange : function() {
                    	var title = '';
                    	Ext.Array.each(this.getValue(), function(t) {
                    		title += '[' + t._refObjectName + '] '
                    	});
                    	this.setRawValue(title);
                    	this.changedValue = true;
                    	this.collapse();
                    },
                    collapse: function () {
                    	if (this.changedValue) {
                    		this.changedValue = false;
                    		Ext.onReady(function() {
                    			App.tagOverride = true;
                    			App.viewport.update(App.viewport.showStats);
                    		});
                    	}
                    }
                }
			}]
		},{
			xtype    : 'container',
			width    : 420,
			layout   : 'hbox',
			defaults : {
				xtype   : 'button',
				width   : 100,
				margins : '0 0 0 5'
			},
			items  : [{
				text    : 'Summary',
				cls     : 'activeButton',
				handler : function() {
					Ext.select('.activeButton').each(function() {
						this.removeCls('activeButton');
					});
					this.addClass('activeButton');
					Ext.onReady(function() {
						App.viewport.showStats();
					});
				}
			},{
				text    : 'All Test Cases',
				handler : function() {
					Ext.select('.activeButton').each(function() {
						this.removeCls('activeButton');
					});
					this.addClass('activeButton');
					Ext.onReady(function() {
						App.viewport.showAll(App.viewport.testCaseArray,[
							{ text: 'ID',        dataIndex: 'FID',         width: 60,                   renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/testcase/' + record.get('OID') + '"><b>' + val + '</b></a>'; }                                         },
							{ text: 'Name',	     dataIndex: 'Name',        flex: 1,    minWidth: 150                                                                                                                                                                                                         },
							{ text: 'Priority',  dataIndex: 'Priority',    width: 100, align: 'center'                                                                                                                                                                                                       },
							{ text: 'Verdict',   dataIndex: 'Verdict',     width: 100, align: 'center'                                                                                                                                                                                                       },
							{ text: 'Last Run',  dataIndex: 'LastRun',     width: 100, align: 'center', renderer: function(val) { return (val) ? val.substring(0,10) : ''; }                                                                                                                                 },
							{ text: 'Work Item', dataIndex: 'WorkItemFID', flex: 1,    minWidth: 150,   renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('WorkItemOID') + '"><b>' + val + ':</b></a> ' + record.get('WorkItemName'); } }
						]);
					});
				}
			},{
				text    : 'All Defects',
				handler : function() {
					Ext.select('.activeButton').each(function() {
						this.removeCls('activeButton');
					});
					this.addClass('activeButton');
					Ext.onReady(function() {
						App.viewport.showAll(App.viewport.defectArray,[
							{ text: 'ID',        dataIndex: 'FID',         width: 60,                   renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/defect/' + record.get('OID') + '"><b>' + val + '</b></a>';                                           } },
							{ text: 'Name',      dataIndex: 'Name',        flex: 1,    minWidth: 150                                                                                                                                                                                                         },
							{ text: 'State',     dataIndex: 'State',       width: 100, align: 'center'                                                                                                                                                                                                       },
							{ text: 'Blocked',   dataIndex: 'Blocked',     width: 100, align: 'center', renderer: function(val) { return (val) ? 'Yes' : 'No';                                                                                                                                             } },
							{ text: 'Work Item', dataIndex: 'WorkItemFID', flex: 1,    minWidth: 150,   renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('WorkItemOID') + '"><b>' + val + ':</b></a> ' + record.get('WorkItemName'); } }
						]);
					});
				}
			},{
				text    : 'Export',
				handler : function(event, toolEl, panel) {
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
		                        	if (!line.match(/x-grid-row-summary/)) excel_data += line.replace(/___/g,' ');
		                        });

		                        var ctx = {worksheet: name || 'Worksheet', table: excel_data};
		                        window.location.href = 'data:application/vnd.ms-excel;base64,' + base64(format(template, ctx));
		                        Ext.getBody().unmask();
		                    }, 500);
	                    }
	                });
				}
			}]
		}]
	},{
		xtype  : 'container',
		id     : 'viewport'
	}],

	launch: function() {
		App = this;
	},

	viewport: {
		testCaseArray : [],
		defectArray   : [],
		stats         : {},
		update: function(callback) {
			Ext.getBody().mask('Loading...');
			var testCaseHash  = {},
				defectHash    = {},
				timeBoxOIDs   = [],
				testCaseOIDs  = [],
				defectOIDs    = [];
			
			var timeBoxLoader = Ext.create('Rally.data.WsapiDataStore', {
				model     : App.down('#filterPicker').getRawValue(),
				filters   : [{
					property : 'Name',
					value    : (App.down('#filterPicker').getValue() == 'Release') ? App.down('#releasePicker').getRawValue() : App.down('#iterPicker').getRawValue()
				}],
				fetch     : ['ObjectID'],
				listeners : {
					load: function(store, data) {
						if (data && data.length) {
							Ext.Array.each(data, function(i) {
								timeBoxOIDs.push(i.raw.ObjectID);
							});
							timeBoxLoader.nextPage();
						} else {
							onTimeBoxOIDs();
						}
					}
				}
			});
			timeBoxLoader.loadPage(1);

			function onTimeBoxOIDs() {
				var filters = [{
					property : '__At',
					value   : 'current'
				},{
					property : '_TypeHierarchy',
					value    : 'HierarchicalRequirement'
				},{
					property : App.down('#filterPicker').getValue(),
					operator : 'in',
					value    : timeBoxOIDs
				},Rally.data.lookback.QueryFilter.or([{
					property : 'TestCases',
					operator : '!=',
					value    : null
				},{
					property : 'Defects',
					operator : '!=',
					value    : null
				}])];
				var tagOIDs = [];
				Ext.Array.each(App.down('#tagPicker').getValue(), function(i) {
					tagOIDs.push(i.ObjectID);
				});
				if (tagOIDs.length > 0) filters.push({
					property : 'Tags',
					operator : 'in',
					value    : tagOIDs
				});

				Ext.create('Rally.data.lookback.SnapshotStore', {
					autoLoad  : true,
					filters   : filters,
					fetch     : ['_UnformattedID','Name','ObjectID','TestCases','Defects'],
					listeners : {
						load : function(store, data) {
							Ext.Array.each(data, function(s) {
								Ext.Array.each(s.raw.TestCases, function(t) {
									testCaseOIDs.push(t);
									testCaseHash[t] = {
										OID          : t,
										WorkItemOID  : s.raw.ObjectID,
										WorkItemName : s.raw.Name,
										WorkItemFID  : 'US' + s.raw._UnformattedID
									};
								});
								Ext.Array.each(s.raw.Defects, function(d) {
									defectOIDs.push(d);
									defectHash[d] = {
										OID          : d,
										WorkItemOID  : s.raw.ObjectID,
										WorkItemName : s.raw.Name,
										WorkItemFID  : 'US' + s.raw._UnformattedID
									};
								});
							});
							onWorkItemOIDs();
						}
					}
				});
			}

			function onWorkItemOIDs() {
				if (testCaseOIDs.length == 0 && defectOIDs.length == 0) {
					Ext.getBody().unmask();
					App.down('#viewport').removeAll();
					Ext.Msg.alert('Error', 'No data was found matching the specified query criteria.');
				} else {
					var defectOIDFilter   = [],
						testCaseOIDFilter = [],
						remaining         = 0;
					Ext.Array.each(testCaseOIDs, function(o, k) {
						testCaseOIDFilter.push({
							property : 'ObjectID',
							value    : o
						});
						if (testCaseOIDFilter.length >= 100 || k == testCaseOIDs.length - 1) {
							remaining++;
							loadDetail('TestCase', testCaseOIDFilter);
							testCaseOIDFilter = [];
						}
					});
					Ext.Array.each(defectOIDs, function(o, k) {
						defectOIDFilter.push({
							property : 'ObjectID',
							value    : o
						});
						if (defectOIDFilter.length == 100 || k == defectOIDs.length - 1) {
							remaining++;
							loadDetail('Defect', defectOIDFilter);
							defectOIDFilter = [];
						}
					});
				}

				function loadDetail(model, filter) {
					Ext.create('Rally.data.WsapiDataStore', {
						autoLoad  : true,
						model     : model,
						filters   : Rally.data.QueryFilter.or(filter),
						fetch     : ['Blocked','State','FormattedID','ObjectID','Name','LastVerdict','LastRun','Priority','WorkProduct','Project','Iteration'],
						listeners : {
							load: function(store, data) {
								if (model == 'TestCase') {
									Ext.Array.each(data, function(t) {
										testCaseHash[t.raw.ObjectID].Name      = t.raw.Name;
										testCaseHash[t.raw.ObjectID].Verdict   = t.raw.LastVerdict;
										testCaseHash[t.raw.ObjectID].LastRun   = t.raw.LastRun;
										testCaseHash[t.raw.ObjectID].Priority  = t.raw.Priority;
										testCaseHash[t.raw.ObjectID].FID       = t.raw.FormattedID;
										testCaseHash[t.raw.ObjectID].Team      = (t.raw.WorkProduct.Project   != null) ? t.raw.WorkProduct.Project._refObjectName   : 'N/A';
										testCaseHash[t.raw.ObjectID].Iteration = (t.raw.WorkProduct.Iteration != null) ? t.raw.WorkProduct.Iteration._refObjectName : 'N/A';
									});
								} else if (model == 'Defect') {
									Ext.Array.each(data, function(d) {
										defectHash[d.raw.ObjectID].Name      = d.raw.Name;
										defectHash[d.raw.ObjectID].FID       = d.raw.FormattedID;
										defectHash[d.raw.ObjectID].Blocked   = d.raw.Blocked;
										defectHash[d.raw.ObjectID].State     = d.raw.State;
										defectHash[d.raw.ObjectID].Team      = (d.raw.Project   != null) ? d.raw.Project._refObjectName   : 'N/A';
										defectHash[d.raw.ObjectID].Iteration = (d.raw.Iteration != null) ? d.raw.Iteration._refObjectName : 'N/A';
									});
								}
								if (!--remaining) onDetailsLoaded();
							}
						}
					});
				}
			}

			function onDetailsLoaded() {
				//Fill defect and test case stores
				App.viewport.testCaseArray = [];
				App.viewport.defectArray   = [];
				for (i in testCaseHash) { App.viewport.testCaseArray.push(testCaseHash[i]); }
				for (i in defectHash)   { App.viewport.defectArray.push(defectHash[i]);     }
				//Calculate Stats
				App.viewport.stats = {};
				Ext.Array.each(App.viewport.testCaseArray, function(t) {
					addIfUndefined(t.Team);
					App.viewport.stats[t.Team].TC_Count++;
					if (t.LastRun == null)           App.viewport.stats[t.Team].TC_NotRunCount++;
					if (t.Verdict == 'Pass')         App.viewport.stats[t.Team].TC_PassedCount++;
					if (t.Verdict == 'Fail')         App.viewport.stats[t.Team].TC_FailedCount++;
					if (t.Verdict == 'Inconclusive') App.viewport.stats[t.Team].TC_InconclusiveCount++;
					if (t.Blocked == true)           App.viewport.stats[t.Team].TC_BlockedCount++;
				});
				Ext.Array.each(App.viewport.defectArray, function(d) {
					addIfUndefined(d.Team);
					App.viewport.stats[d.Team].DE_Count++;
					if (d.State == 'Closed') App.viewport.stats[d.Team].DE_ClosedCount++;
					if (d.State == 'Open')   App.viewport.stats[d.Team].DE_OpenCount++;
				});

				Ext.getBody().unmask();
				callback();

				function addIfUndefined(team_name) {
					if (App.viewport.stats[team_name] == undefined) {
						App.viewport.stats[team_name] = {
							Team                 : team_name,
							TC_Count             : 0,
							TC_NotRunCount       : 0,
							TC_PassedCount       : 0,
							TC_FailedCount       : 0,
							TC_InconclusiveCount : 0,
							TC_BlockedCount      : 0,
							DE_Count             : 0,
							DE_OpenCount         : 0,
							DE_ClosedCount       : 0
						};
					}
				}
			}
		},

		showStats: function() {
			var statsArray = [];
			for (s in App.viewport.stats) { statsArray.push(App.viewport.stats[s]); }
			App.down('#viewport').removeAll();
			App.down('#viewport').add({
				xtype             : 'rallygrid',
				id                : 'rally_grid',
				disableSelection  : true,
				showPagingToolbar : false,
				store             : Ext.create('Rally.data.custom.Store', {
					data       : statsArray,
					pageSize   : 1000,
					sorters    : [
						{ property: 'Team', direction: 'ASC' }
					]
				}),
				features : [{
					ftype : 'summary'
				}],
				columnCfgs: [{
					text            : 'Team',
					dataIndex       : 'Team',
					width           : 300
				},{ 
					text            : 'Total Test Cases',
					dataIndex       : 'TC_Count',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{ 
					text            : 'Test Cases Not Run',
					dataIndex       : 'TC_NotRunCount',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{ 
					text            : 'Passed Test Cases',
					dataIndex       : 'TC_PassedCount',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{ 
					text            : 'Failed Test Cases',
					dataIndex       : 'TC_FailedCount',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{
					text            : 'Inconclusive Test Cases',
					dataIndex       : 'TC_InconclusiveCount',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{ 
					text            : 'Total Defects',
					dataIndex       : 'DE_Count',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{ 
					text            : 'Open Defects',
					dataIndex       : 'DE_OpenCount',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				},{ 
					text            : 'Closed Defects',
					dataIndex       : 'DE_ClosedCount',
					flex            : 1,
					align           : 'center',
					summaryType     : 'sum',
					summaryRenderer : function(val, data, idx) {
		                return '<b>' + Ext.util.Format.number(val, '0,0') + '</b>';
		            }
				}]
			});
		},

		showAll: function(item_array, columns) {
			App.down('#viewport').removeAll();
			App.down('#viewport').add({
				xtype             : 'rallygrid',
				id                : 'rally_grid',
				disableSelection  : true,
				showPagingToolbar : false,
				store             : Ext.create('Rally.data.custom.Store', {
					data       : item_array,
					groupField : 'Team',
					pageSize   : 1000,
					sorters    : [
						{ property: 'Team',        direction: 'ASC' },
						{ property: 'WorkItemFID', direction: 'ASC' }
					]
				}),
				features: [Ext.create('Ext.grid.feature.Grouping', {
		        	groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
		   		})],
				columnCfgs: columns
			});
		}
	}
});