Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout:'border',
	defaults: {
		collapsible : true,
		collapsed   : false,
		split       : true
	},
	items: [{
		title    : 'Settings',
		id       : 'popout',
		region   : 'west',
		margins  : '5 0 0 0',
		width    : 300,
		layout   : 'vbox',
		defaults : {
			margin     : '10px 0px 0 5px',
			labelAlign : 'right',
			width      : 285,
			labelWidth : 90
		},
		items    : [{
			xtype                   : 'rallyattributecombobox',
			id                      : 'release_filter',
			model                   : 'UserStory',
			field                   : 'QuarterlyRelease',
			fieldLabel              : 'Quarterly Release:',
			defaultSelectionToFirst : false,
			listeners               : {
				ready  : function() {
					Ext.onReady(function() {
						App.Viewport.newQuery();
					});
				},
    			change : function() {
    				Ext.onReady(function() {
						App.Viewport.newQuery();
					});
    			}
			}
		},{
			xtype       : 'rallymultiobjectpicker',
			id          : 'tag_filter',
			modelType   : 'Tag',
			fieldLabel  : 'Tag Filter',
			stateful    : true,
			stateId     : 'qrmTags',
			stateEvents : [ 'collapse' ],
			getState    : function() { return { value: this.getValue() }; },
			applyState  : function(state) { this.setValue(state.value); },
			listeners   : {
				blur: function() {
					this.collapse();
				},
				selectionchange : function() { 
    				Ext.onReady(function() {
    					App.UserInterface.TagFilter.isChanged = true;
    				});
    			},
    			collapse : function() {
					Ext.onReady(function() {
						if (App.UserInterface.TagFilter.isChanged) {
							App.UserInterface.TagFilter.update();
							App.Viewport.newQuery();
						}
					});				
    			},
    			added : function() {
    				Ext.onReady(function() {
    					App.UserInterface.TagFilter.update();
    				});
    			}
			}
		},{
			xtype : 'container',
			id    : 'selected_tags'
		},{
			xtype      : 'rallyiterationcombobox',
			id         : 'iter_filter',
			fieldLabel : 'Iteration:',
			hidden     : true
		}]
	},{
		xtype       : 'tabpanel',
		id          : 'viewport',
		collapsible : false,
		region      : 'center',
		margins     : '5 0 0 0',
		activeTab   : 0,
		minTabWidth : 150,
		items       : [
			{ title : 'Track'           },
			{ title : 'Burndown'        },
			{ title : 'Burnup'          },
			{ title : 'Cumulative Flow' }
		],
		listeners: {
			'tabchange' : function() {
				Ext.onReady(App.Viewport.drawTab);
			}
		}
	}],

    launch: function() {
    	App = this;
    },

    Viewport: {
    	wsStore : [],
    	newQuery: function() {
    		// Clear existing store
    		App.Viewport.wsStore = [];
    		// Create the filter object
    		var filter = new Rally.data.QueryFilter({
    			property: 'ProjectQuarterlyRelease', value: App.down('#release_filter').getValue()
    		});
    		Ext.Array.each(App.down('#tag_filter').getValue(), function(tag) {
				filter = filter.and(new Rally.data.QueryFilter({
					property: 'Tags.Name', operator: 'contains', value: tag._refObjectName
				}));
			});
			// Load data into the store
    		var loader = Ext.create('Rally.data.WsapiDataStore', {
    			model: 'UserStory',
    			filters: filter,
    			fetch: [
    				'FormattedID',
    				'Name',
    				'ObjectID',
    				'Owner',
    				'PlanEstimate',
    				'Project',
    				'ScheduleState',
    				'TaskEstimateTotal'
    			],
    			listeners: {
    				load: function(store, data) {
    					if (data && data.length) {
	    					Ext.Array.each(data, function(s) {
	    						App.Viewport.wsStore.push({
	    							FormattedID  : s.raw.FormattedID,
	    							Name         : s.raw.Name,
	    							ObjectID     : s.raw.ObjectID,
	    							Owner        : s.raw.Owner._refObjectName,
	    							PlanEstimate : s.raw.PlanEstimate || 0,
	    							Project      : s.raw.Project._refObjectName,
	    							State        : s.raw.ScheduleState,
	    							TaskHours    : s.raw.TaskEstimateTotal || 0
	    						});
	    					});
	    					loader.nextPage();
    					} else {
    						App.Viewport.drawTab();
    					}
    				}
    			}
    		});
    		loader.loadPage(1);
    	},
    	drawTab: function() {
    		App.down('#viewport').getActiveTab().removeAll();
    		var activeTab = App.down('#viewport').items.findIndex('id', App.down('#viewport').getActiveTab().id);
    		if (activeTab == 0) App.down('#iter_filter').hide();
    		else App.down('#iter_filter').show();
    		var renderFunctions = [
    			function() { // Track
    				console.log('Track');
    				App.down('#viewport').getActiveTab().add({
	                    xtype: 'rallygrid',
	                    disableSelection: true,
	                    store: Ext.create('Rally.data.custom.Store', {
							data     : App.Viewport.wsStore,
							pageSize : 25
	                    }),
	                    columnCfgs: [
	                    	{ text: 'ID',         dataIndex: 'FormattedID',  width : 60, renderer  : function(value, meta, record) { return '<a href="https://sandbox.rallydev.com/#/detail/userstory/' + record.get('ObjectID') + '">' + record.get('FormattedID') + '</a>'; } },
	                    	{ text: 'Name',       dataIndex: 'Name',         flex: 1    },
	                    	{ text: 'Project',    dataIndex: 'Project',      flex: 1    },
	                    	{ text: 'State',      dataIndex: 'State',        width: 90  },
	                    	{ text: 'Points',     dataIndex: 'PlanEstimate', width: 90  },
	                    	{ text: 'Task Hours', dataIndex: 'TaskHours',    width: 90  }
	                    ]
    				});
    			},
    			function() { // Burndown
    				console.log('Burndown');
    			},
    			function() { // Burnup
    				console.log('Burnup');
    			},
    			function() { // Cumulative Flow
    				console.log('Cumulative Flow');
    			}
    		];
    		renderFunctions[activeTab]();
    	}
    },

    UserInterface: {
	    TagFilter: {
	    	isChanged: true,
	    	update: function() {
    			App.UserInterface.TagFilter.isChanged = false;
		        var selectedTagsText = '';
		        Ext.Array.each(App.down('#tag_filter').getValue(), function(tag) {
		            selectedTagsText += '<div class="icon">' + tag.Name + '</div>';
		        });
		        App.down('#selected_tags').removeAll();
		        App.down('#selected_tags').add({
		            border: 0,
		            html: selectedTagsText
		        });
	    	}
	    }
    }
});