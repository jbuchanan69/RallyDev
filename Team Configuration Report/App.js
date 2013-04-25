// Team Configuration Report - Version 0.4.1
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
		margins : '5 5 0 0'
	},
	items: [{
		title   : 'Initiative',
		region  : 'west',
		width   : 315,
		layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        },
        tools:[{
		    type:'save',
		    tooltip: 'Save CSV',
		    handler: function(event, toolEl, panel){
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
	                            excel_data += (column_header_span.replace('span','td'));
	                        });
	                        excel_data += '</tr>';
	                        excel_data += table.innerHTML.replace(/<span .*?x-column-header-text.*?>.*?<\/span>/gm,'').replace(/<div class="x-grid-group-title".*?>.*?<\/div>/gm,'').replace(/___/gm,' ');

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
			flex   : 1
        },{
			id     : 'settingsContainer',
			height : 0, //35,
			items  : [{
				hidden     : true,
				xtype      : 'rallymultiobjectpicker',
				id         : 'tagPicker',
				modelType  : 'Tag',
				fieldLabel : 'Tags:',
				labelWidth : 25,
				width      : 300,
				margin     : 5,
				listeners  : {
                    blur: function() {
                        this.collapse();
                    },
                    selectionchange : function() {
                    	var title = '';
                    	Ext.Array.each(this.getValue(), function(t) {
                    		title += '[' + t._refObjectName + '] '
                    	});
                    	this.setRawValue(title);
                    	this.changedValue = true;
                    },
                    collapse: function () {
                    	if (this.changedValue) {
                    		this.changedValue = false;
                    		Ext.onReady(function() {
                    			App.tagOverride = true;
                    			App.viewport.update();
                    		});
                    	}
                    }
                }
			}]
        }]
	},{
		xtype       : 'tabpanel',
		id          : 'viewport',
		collapsible : false,
		region      : 'center',
		margins     : '5 0 0 0',
		activeTab   : 0, // index or id
		defaults    : {
			autoScroll  : true
		},
		items       : [{
			title : 'Dashboard',
			id    : 'tab0'
		},{
			title : 'Unlinked User Stories',
			id    : 'tab1'
		},{
			title : 'Untagged User Stories',
			id    : 'tab2'
		},{
			title : 'Unestimated User Stories',
			id    : 'tab3'
		}],
		listeners   : {
			beforetabchange: function(panel, newTab, oldTab) {
				Ext.onReady(function() {
					oldTab.removeAll();
				});
			},
			tabchange : function() {
				Ext.onReady(function() {
					App.viewport.drawTab();
				});
			}
		}
	}],

	launch: function() {
		Ext.getBody().mask('Initializing UI...');
		App = this;
		App.viewableProjects = [];
		App.teamNameHash     = [];
		//Find out what projects I have access to
		var teamLoader = Ext.create('Rally.data.WsapiDataStore', {
			model     : 'Project',
			fetch     : ['ObjectID','Name'],
			listeners : {
				load : function(store, data) {
					Ext.Array.each(data, function(p) {
						App.viewableProjects.push(p.raw.ObjectID);
						App.teamNameHash[p.raw.ObjectID] = p.raw.Name;
					});
				}
			}
		});
		teamLoader.loadPages({
			callback: App.rpmTree.init
		})
	},

	rpmTree: {
		init: function() {
			Ext.create('Rally.data.WsapiDataStore', {
	            autoLoad: true,
	            model: 'PortfolioItem/Initiative',
	            filters : [{
	            	property : 'LeafStoryCount',
	            	operator : '>',
	            	value    : 0
	            }],
	            fetch: ['Children','LeafStoryCount','Name','ObjectID','Tags'],
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
		                    		text : ' ' + i.raw.Name,
		                    		id   : i.raw.ObjectID,
		                    		leaf : true,
		                    		tags : i.raw.Tags
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
					xtype       : 'treepanel',
					store       : Ext.create('Ext.data.TreeStore', {
						root: {
							expanded: true,
							children: roots
						}
					}),
					id          : 'rpmTree',
					rootVisible : false,
					margin      : '-1 0 0 0',
					border      : 0,
					listeners   : {
						added : function() {
							Ext.getBody().unmask();
						},
						selectionchange: function() {
							App.tagOverride = false;
							App.down('#tagPicker').fireEvent('change');
							App.viewport.update();
						}
					}
				});
				
			}
		}
	},

	viewport: {
		teamNameHash : {},
		iterNameHash : {},
		ensureTeamExists : function(team_name) {
			if (App.viewport.teamCounts[team_name] == undefined) {
				App.viewport.teamCounts[team_name] = {
					TeamName         : team_name,
					UnlinkedCount    : 0,
					UntaggedCount    : 0,
					UnestimatedCount : 0
				};
			}
		},
		update: function() {
			if (App.down('#rpmTree').getSelectionModel().getSelection().length == 0) return;
			Ext.getBody().mask('Loading...');
			App.viewport.rpmUserStories         = {};
			App.viewport.taggedUserStories      = {};
			App.viewport.untaggedUserStories    = [];
			App.viewport.unlinkedUserStories    = [];
			App.viewport.unestimatedUserStories = [];
			App.viewport.teamCounts             = {};
			App.viewport.undetailedIters        = [];
			if (!App.tagOverride) {
				App.down('#tagPicker').setValue(App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.tags);
				var title = '';
            	Ext.Array.each(App.down('#tagPicker').getValue(), function(t) {
            		title += '[' + t._refObjectName + '] '
            	});
            	App.down('#tagPicker').setRawValue(title);
			}
			//Get all descendant stories from the selected RPM level
			Ext.create('Rally.data.lookback.SnapshotStore', {
				autoLoad : true,
				pageSize : 1000000,
				fetch    : ['Name','ObjectID','_UnformattedID','PlanEstimate','ScheduleState','Project','Iteration'],
				hydrate  : ['ScheduleState'],
				filters  : [{
					property : '__At',
					value    : 'current'
				},{
					property : '_TypeHierarchy',
					value    : 'HierarchicalRequirement'
				},{
					property : '_ItemHierarchy',
					value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].data.id
				},{
					property : 'Project',
					operator : 'in',
					value    : App.viewableProjects
				}],
				listeners : {
					load : function(store, data) {
						Ext.Array.each(data, function(s) {
							s.raw.TeamName = App.teamNameHash[s.raw.Project];
							s.raw.ex_TeamName = App.teamNameHash[s.raw.Project];
							App.viewport.ensureTeamExists(s.raw.TeamName);
							App.viewport.rpmUserStories[s.raw.ObjectID] = s.raw;
							if (s.raw.Iteration && !s.raw.PlanEstimate) App.viewport.unestimatedUserStories.push(s.raw);
							if (s.raw.Iteration && App.viewport.iterNameHash[s.raw.Iteration] == undefined) {
								App.viewport.iterNameHash[s.raw.Iteration] = '';
								App.viewport.undetailedIters.push(s.raw.Iteration);
							}
						});
						onRPMStoriesLoaded();
					}
				}
			});

			function onRPMStoriesLoaded() {
				var tagFilter = [];
				Ext.Array.each(App.down('#tagPicker').getValue(), function(t) {
					tagFilter.push(t.ObjectID)
				});
				//Make sure tags exist
				if (tagFilter.length == 0) {
					Ext.getBody().unmask();
					Ext.Msg.alert('Error', '<div style="text-align:center">There are no tags associated with this project.<br /><a href="https://rally1.rallydev.com/slm/portfolioitem/initiative/edit.sp?oid=' + App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id + '">ADD TAGS HERE</a></div>');
					App.down('#viewport').getActiveTab().removeAll();
					App.down('#tab1').setTitle('Unlinked User Stories');
					App.down('#tab2').setTitle('Untagged User Stories');
					App.down('#tab3').setTitle('Unestimated User Stories');
					return;
				}

				Ext.create('Rally.data.lookback.SnapshotStore', {
					autoLoad : true,
					pageSize : 1000000,
					fetch    : ['Name','ObjectID','_UnformattedID','PlanEstimate','ScheduleState','Project','Iteration'],
					hydrate  : ['ScheduleState'],
					filters  : [{
						property : '__At',
						value    : 'current'
					},{
						property : '_TypeHierarchy',
						value    : 'HierarchicalRequirement'
					},{
						property : 'Project',
						operator : 'in',
						value    : App.viewableProjects
					},{
						property : 'Tags',
						operator : 'in',
						value    : tagFilter
					}],
					listeners : {
						load : function(store, data) {
							Ext.Array.each(data, function(s) {
								s.raw.TeamName = App.teamNameHash[s.raw.Project];
								s.raw.ex_TeamName = App.teamNameHash[s.raw.Project];
								App.viewport.ensureTeamExists(s.raw.TeamName);
								App.viewport.taggedUserStories[s.raw.ObjectID] = s.raw;
								if (s.raw.Iteration && !s.raw.PlanEstimate && App.viewport.rpmUserStories[s.raw.ObjectID] == undefined) App.viewport.unestimatedUserStories.push(s.raw);
								if (s.raw.Iteration && App.viewport.iterNameHash[s.raw.Iteration] == undefined) {
									App.viewport.iterNameHash[s.raw.Iteration] = '';
									App.viewport.undetailedIters.push(s.raw.Iteration);
								}
							});
							onTaggedStoriesLoaded();
						}
					}
				});

				function onTaggedStoriesLoaded() {
					for (i in App.viewport.rpmUserStories) {
						if (App.viewport.taggedUserStories[i] == undefined)
							App.viewport.untaggedUserStories.push(App.viewport.rpmUserStories[i]);
					}
					for (i in App.viewport.taggedUserStories) {
						if (App.viewport.rpmUserStories[i] == undefined)
							App.viewport.unlinkedUserStories.push(App.viewport.taggedUserStories[i]);
					}
					App.down('#tab1').setTitle('Unlinked User Stories ('    + App.viewport.unlinkedUserStories.length    + ')');
					App.down('#tab2').setTitle('Untagged User Stories ('    + App.viewport.untaggedUserStories.length    + ')');
					App.down('#tab3').setTitle('Unestimated User Stories (' + App.viewport.unestimatedUserStories.length + ')');
					if (App.viewport.undetailedIters.length > 0) {
						getIterDetail();
					} else {
						App.viewport.drawTab();
					}
				}

				function getIterDetail() {
					var filter = [];
					var remaining = 0;
					Ext.Array.each(App.viewport.undetailedIters, function(i, k) {
						filter.push({
							property : 'ObjectID',
							value    : i
						});
						if (filter.length >= 50 || k == App.viewport.undetailedIters.length - 1) {
							remaining++;
							runIterQuery();
							filter = [];
						}
					});
					
					function runIterQuery() {
						Ext.create('Rally.data.WsapiDataStore', {
							autoLoad  : true,
							model     : 'Iteration',
							fetch     : ['ObjectID','Name'],
							filters   : Rally.data.QueryFilter.or(filter),
							listeners : {
								load : function(store, data) {
									Ext.Array.each(data, function(i) {
										App.viewport.iterNameHash[i.raw.ObjectID] = i.raw._refObjectName;
									});
									if (!--remaining) App.viewport.drawTab();
								}
							}
						});
					}	
				}
			}
		},

		drawTab : function() {
			if (App.down('#tagPicker').getValue().length == 0) return; //No tags associated

			Ext.getBody().unmask();
			App.down('#viewport').getActiveTab().removeAll();
			
			[
				function() {
					var gridArray = [];
					for (t in App.viewport.teamCounts) { //Reset counts to zero before redrawing the tab
						App.viewport.teamCounts[t].UnlinkedCount    = 0;
						App.viewport.teamCounts[t].UntaggedCount    = 0;
						App.viewport.teamCounts[t].UnestimatedCount = 0;
					}
					Ext.Array.each(App.viewport.unlinkedUserStories, function(i) {
						App.viewport.teamCounts[i.TeamName].UnlinkedCount++;
					});
					Ext.Array.each(App.viewport.untaggedUserStories, function(i) {
						App.viewport.teamCounts[i.TeamName].UntaggedCount++;
					});
					Ext.Array.each(App.viewport.unestimatedUserStories, function(i) {
						App.viewport.teamCounts[i.TeamName].UnestimatedCount++;
					});
					for (t in App.viewport.teamCounts) {
						gridArray.push(App.viewport.teamCounts[t]);
					}
					App.down('#viewport').getActiveTab().add({
						xtype             : 'rallygrid',
						id                : 'rally_grid',
						disableSelection  : true,
						showPagingToolbar : false,
						store             : Ext.create('Rally.data.custom.Store', {
							data     : gridArray,
							pageSize : 1000000,
							sorters  : [{
								property  : 'TeamName',
								direction : 'ASC'
							}]
						}),
						features: [{
				            ftype: 'summary'
				        }],
						columnCfgs : [{
							text        : 'Team',
							dataIndex   : 'TeamName',
							flex        : 1,
							minWidth    : 150,
							summaryType : function() {
								var retStr = '<b>' + ((App.down('#tagPicker').getValue().length > 1) ? 'Tags' : 'Tag') + ':</b> ';
								Ext.Array.each(App.down('#tagPicker').getValue(), function(t) {
									retStr += '[' + t._refObjectName + '] ';
								});
								return retStr;
							}
						},{
							text      : 'Unlinked User Stories',
							dataIndex : 'UnlinkedCount',
							minWidth  : 100,
							align     : 'center',
							renderer  : function(val) {
								return '<div class="' + valToColor(val) + ' label">' + val + '</div>';
							}
						},{
							text      : 'Untagged User Stories',
							dataIndex : 'UntaggedCount',
							minWidth  : 100,
							align     : 'center',
							renderer  : function(val) {
								return '<div class="' + valToColor(val) + ' label">' + val + '</div>';
							}
						},{
							text      : 'Unestimated User Stories',
							dataIndex : 'UnestimatedCount',
							minWidth  : 100,
							align     : 'center',
							renderer  : function(val) {
								return '<div class="' + valToColor(val) + ' label">' + val + '</div>';
							}
						}]
					});

					function valToColor(val) {
						return (val == 0) ? 'green' : (val <= 5) ? 'yellow' : 'red';
					}
				},
				function() {
					drawDetailGrid(App.viewport.unlinkedUserStories);
				},
				function() {
					drawDetailGrid(App.viewport.untaggedUserStories);
				},
				function() {
					drawDetailGrid(App.viewport.unestimatedUserStories)
				}
			][App.down('#viewport').items.findIndex('id', App.down('#viewport').getActiveTab().id)]();

			function drawDetailGrid(data) {
				App.down('#viewport').getActiveTab().add({
					xtype             : 'rallygrid',
					id                : 'rally_grid',
					disableSelection  : true,
					showPagingToolbar : false,
					store             : Ext.create('Rally.data.custom.Store', {
						data       : data,
						pageSize   : 1000000,
						groupField : 'TeamName',
						sorters    : [{
							property  : 'TeamName',
							direction : 'ASC'
						}]
					}),
					features: [Ext.create('Ext.grid.feature.Grouping', {
			        	groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
			   		})],
					columnCfgs : [{
						text      : 'Team Name',
						dataIndex : 'ex_TeamName',
						hidden    : true,
						renderer  : function(val) {
							return val.replace(/ /g,'___');
						}
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
						flex      : 1
					},{
						text      : 'Plan Estimate',
						dataIndex : 'PlanEstimate',
						width     : 90,
						align     : 'center'
					},{
						text      : 'Schedule State',
						dataIndex : 'ScheduleState',
						width     : 90,
						align     : 'center'
					},{
						text      : 'Iteration',
						dataIndex : 'Iteration',
						width     : 180,
						align     : 'center',
						renderer  : function(val) {
							return App.viewport.iterNameHash[val];
						}
					}]
				});	
			}
		}
	}
});