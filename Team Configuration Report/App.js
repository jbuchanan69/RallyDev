// Team Configuration Report - Version 0.2
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
        items: [{
			id     : 'rpmTreeContainer',
			layout : 'fit',
			flex   : 1
        },{
			id     : 'settingsContainer',
			height : 35,
			items  : [{
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
			autoScroll : true
		},
		items       : [{
			title : 'Unlinked User Stories',
			id    : 'tab0'
		},{
			title : 'Untagged User Stories',
			id    : 'tab1'
		}],
		listeners   : {
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
		update: function() {
			if (App.down('#rpmTree').getSelectionModel().getSelection().length == 0) return;
			Ext.getBody().mask('Loading...');
			App.viewport.rpmUserStories      = {};
			App.viewport.taggedUserStories   = {};
			App.viewport.untaggedUserStories = [];
			App.viewport.unlinkedUserStories = [];
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
				fetch    : ['Name','ObjectID','_UnformattedID','PlanEstimate','ScheduleState','Project'],
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
							App.viewport.rpmUserStories[s.raw.ObjectID] = s.raw;
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
					Ext.Msg.alert('Error', 'There are no tags associated with this project. Please select tag(s) from the menu to relate to the project.');
					App.down('#viewport').getActiveTab().removeAll();
					App.down('#tab0').setTitle('Unlinked User Stories');
					App.down('#tab1').setTitle('Untagged User Stories');
					return;
				}

				Ext.create('Rally.data.lookback.SnapshotStore', {
					autoLoad : true,
					pageSize : 1000000,
					fetch    : ['Name','ObjectID','_UnformattedID','PlanEstimate','ScheduleState','Project'],
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
								App.viewport.taggedUserStories[s.raw.ObjectID] = s.raw;
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
					App.down('#tab0').setTitle('Unlinked User Stories (' + App.viewport.unlinkedUserStories.length + ')');
					App.down('#tab1').setTitle('Untagged User Stories (' + App.viewport.untaggedUserStories.length + ')');
					App.viewport.drawTab();
				}

			}
		},

		drawTab : function() {
			Ext.getBody().unmask();
			var tab_number = App.down('#viewport').items.findIndex('id', App.down('#viewport').getActiveTab().id);
			App.down('#viewport').getActiveTab().removeAll();
			App.down('#viewport').getActiveTab().add({
				xtype             : 'rallygrid',
				disableSelection  : true,
				showPagingToolbar : false,
				store             : Ext.create('Rally.data.custom.Store', {
					data       : (tab_number == 0) ? App.viewport.unlinkedUserStories : App.viewport.untaggedUserStories,
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
				}]
			});	
		}
	}
});