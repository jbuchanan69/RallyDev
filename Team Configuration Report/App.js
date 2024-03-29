// Team Configuration Report - Version 0.5.5
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
		title   : 'Project',
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
		minTabWidth : 175,
		defaults    : {
			autoScroll  : true
		},
		items       : [{
			title : 'Dashboard',
			id    : 'tab0'
		},{
			title : 'Unparented User Stories',
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
		Ext.getBody().mask('Initializing UI');
		App = this;
		App.viewableTeams = [];
		App.teamNameHash  = [];
		//Find out what projects I have access to
		var loader = Ext.create('Rally.data.WsapiDataStore', {
			model     : 'Project',
			fetch     : ['ObjectID','Name'],
			listeners : {
				load : function(store, data) {
					if (data && data.length) {
						Ext.Array.each(data, function(p) {
							App.viewableTeams.push(p.raw.ObjectID);
							App.teamNameHash[p.raw.ObjectID] = p.raw.Name;
						});
						loader.nextPage();
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
	            	'ObjectID',
	            	'Tags'
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
		                    		leaf : i.raw.Children == undefined || i.raw.Children.length == 0,
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
					                    		leaf : c.raw.Children == undefined || c.raw.Children.length == 0,
					                    		tags : c.raw.Tags
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
									fetch     : ['Children','LeafStoryCount','Name','ObjectID','Tags'],
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
			Ext.getBody().mask('Loading');
			App.viewport.rpmStories    = {};
			App.viewport.taggedStories = {};

			var tags = [];
			Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.tags, function(t) {
				tags.push(t.ObjectID);
			});
			if (tags.length == 0) {
				Ext.Msg.alert('Error', 'There are no tags associated with the selected RPM project.');
				App.down('#viewport').getActiveTab().removeAll();
				Ext.getBody().unmask();
				return;
			}

			getStories(
				{
					property : '_ItemHierarchy',
					value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
				},
				App.viewport.rpmStories,
				function () {
					getStories(
						{
							property : 'Tags',
							operator : 'in',
							value    : tags
						},
						App.viewport.taggedStories,
						App.viewport.doStats
					);
				}
			);

			function getStories(extraFilter, storyObj, callback) {
				var filters = [{
					property : '__At',
					value    : 'current'
				},{
					property : '_TypeHierarchy',
					value    : 'HierarchicalRequirement'
				},{
					property : 'Children',
					value    : null
				},{
					property : 'Project',
					operator : 'in',
					value    : App.viewableTeams
				}];
				filters.push(extraFilter);
				Ext.create('Rally.data.lookback.SnapshotStore', {
					autoLoad : true,
					pageSize : 1000000,
					fetch    : ['_UnformattedID','Name','PlanEstimate','ScheduleState','Project','Tags'],
					hydrate  : ['ScheduleState'],
					filters  : filters,
					listeners : {
						load : function(store, data, success) {
							Ext.Array.each(data, function(i) {
								i.raw.Team               = App.teamNameHash[i.raw.Project];
								i.raw.TeamNoSpace        = App.teamNameHash[i.raw.Project].replace(/ /g, '___');
								i.raw.ScheduleState      = Ext.Array.indexOf(['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'], i.raw.ScheduleState);
								storyObj[i.raw.ObjectID] = i.raw;
							});
							callback();
						}
					}
				});
			}
		},

		doStats: function() {
			App.viewport.untaggedStories    = [];
			App.viewport.unparentedStories  = [];
			App.viewport.unestimatedStories = [];
			App.viewport.dashboardData      = [];
			App.viewport.dashboardDataObj   = {};
			for (i in App.viewport.rpmStories) {
				if (App.viewport.dashboardDataObj[App.viewport.rpmStories[i].Project] == undefined) {
					App.viewport.dashboardDataObj[App.viewport.rpmStories[i].Project] = {
						Team               : App.viewport.rpmStories[i].Team,
						unparentedStories  : 0,
						untaggedStories    : 0,
						unestimatedStories : 0
					};
				}
				if (App.viewport.rpmStories[i].PlanEstimate  == 0 &&
					App.viewport.rpmStories[i].ScheduleState != 0 &&
					App.viewport.rpmStories[i].ScheduleState != 4) {
						App.viewport.unestimatedStories.push(App.viewport.rpmStories[i]);
						App.viewport.dashboardDataObj[App.viewport.rpmStories[i].Project].unestimatedStories++;
				}
				if (App.viewport.taggedStories[i] === undefined) {
					App.viewport.untaggedStories.push(App.viewport.rpmStories[i]);
					App.viewport.dashboardDataObj[App.viewport.rpmStories[i].Project].untaggedStories++;
				}
			}
			for (i in App.viewport.taggedStories) {
				if (App.viewport.dashboardDataObj[App.viewport.taggedStories[i].Project] == undefined) {
					App.viewport.dashboardDataObj[App.viewport.taggedStories[i].Project] = {
						Team               : App.viewport.taggedStories[i].Team,
						unparentedStories  : 0,
						untaggedStories    : 0,
						unestimatedStories : 0
					};
				}
				if (App.viewport.rpmStories[i] === undefined) {
					App.viewport.unparentedStories.push(App.viewport.taggedStories[i]);
					App.viewport.dashboardDataObj[App.viewport.taggedStories[i].Project].unparentedStories++;
					if (App.viewport.taggedStories[i].PlanEstimate  == 0 &&
						App.viewport.taggedStories[i].ScheduleState != 0 &&
						App.viewport.taggedStories[i].ScheduleState != 4) {
							App.viewport.unestimatedStories.push(App.viewport.taggedStories[i]);
							App.viewport.dashboardDataObj[App.viewport.taggedStories[i].Project].unestimatedStories++;
					}
				}
			}
			for (i in App.viewport.dashboardDataObj) {
				if (App.viewport.dashboardDataObj[i].Team != undefined)
					App.viewport.dashboardData.push(App.viewport.dashboardDataObj[i]);
			}
			App.down('#tab1').setTitle('Unparented User Stories (' + App.viewport.unparentedStories.length + ')');
			App.down('#tab2').setTitle('Untagged User Stories (' + App.viewport.untaggedStories.length + ')');
			App.down('#tab3').setTitle('Unestimated User Stories (' + App.viewport.unestimatedStories.length + ')');
			App.viewport.drawTab();
		},

		drawTab: function() {
			Ext.getBody().unmask();
			if (App.down('#rpmTree').getSelectionModel().getSelection().length == 0) return;
			var tab_number = App.down('#viewport').items.findIndex('id', App.down('#viewport').getActiveTab().id);
			if (tab_number > 0) {
				drawGrid(
					[null, App.viewport.unparentedStories, App.viewport.untaggedStories, App.viewport.unestimatedStories][tab_number], true,
					[{
						text      : 'Team',
						dataIndex : 'TeamNoSpace',
						hidden    : true
					},{
						text      : 'ID',
						dataIndex : '_UnformattedID',
						width     : 80,
						renderer  : function(val, meta, record) {
							return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('ObjectID') + '">US' + val + '</a>';
						}
					},{
						text      : 'Name',
						dataIndex : 'Name',
						flex      : 1,
						minWidth  : 160
					},{
						text      : 'Plan Estimate',
						dataIndex : 'PlanEstimate',
						width     : 160,
						align     : 'center'
					},{
						text      : 'State',
						dataIndex : 'ScheduleState',
						width     : 160,
						align     : 'center',
						renderer  : function(val) {
							return ['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'][val];
						}
					}]
				);
			} else {
				drawGrid(App.viewport.dashboardData, false, [{
					text      : 'Team',
					dataIndex : 'Team',
					flex      : 1,
					minWidth  : 160
				},{
					text      : 'Unparented User Stories',
					dataIndex : 'unparentedStories',
					width     : 160,
					align     : 'center',
					renderer  : function(val, meta) {
						(val == 0) ? meta.tdCls = 'green' : (val <= 5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return val;
					}
				},{
					text      : 'Untagged User Stories',
					dataIndex : 'untaggedStories',
					width     : 160,
					align     : 'center',
					renderer  : function(val, meta) {
						(val == 0) ? meta.tdCls = 'green' : (val <= 5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return val;
					}
				},{
					text      : 'Unestimated User Stories',
					dataIndex : 'unestimatedStories',
					width     : 160,
					align     : 'center',
					renderer  : function(val, meta) {
						(val == 0) ? meta.tdCls = 'green' : (val <= 5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return val;
					}
				}]);
			}

			function drawGrid(gridArray, groupTeams, columns) {
				App.down('#viewport').getActiveTab().removeAll();
				App.down('#viewport').getActiveTab().add({
					xtype             : 'rallygrid',
					id                : 'rally_grid',
					disableSelection  : true,
					showPagingToolbar : false,
					store             : Ext.create('Rally.data.custom.Store', {
						data       : gridArray,
						groupField : (groupTeams) ? 'Team' : null,
						pageSize   : 1000000,
						sorters    : [{
							property  : 'Team',
							direction : 'ASC'
						},{
							property  : 'ScheduleState',
							direction : 'ASC'
						}]
					}),
					features: [Ext.create('Ext.grid.feature.Grouping', {
				       	groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
				   	})],
					columnCfgs : columns
				});
				var tags_string = '<b>Tags:</b>';
				Ext.Array.each(App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.tags, function(t) {
					tags_string += ' [' + t.Name + ']';
				});
				App.down('#viewport').getActiveTab().add({
					xtype : 'container',
					html  : tags_string,
					style : {
						margin : '5px 0 5px 5px'
					}
				});
			}
		}
	}
});