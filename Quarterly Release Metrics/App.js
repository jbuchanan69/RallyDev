// Quarterly Release Metrics - Version 0.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
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
		title     : 'Settings',
		id        : 'popout',
		region    : 'west',
		margins   : '5 0 0 0',
		width     : 270,
		layout    : 'vbox',
		defaults  : {
			margin     : '10px 0px 0 5px',
			labelAlign : 'right',
			width      : 250,
			labelWidth : 50
		},
		items    : [{
			xtype : 'container',
			id    : 'releasePickerContainer'
		},{
			xtype       : 'rallymultiobjectpicker',
			id          : 'tag_filter',
			modelType   : 'Tag',
			fieldLabel  : 'Tag Filter',
			stateful    : true,
			stateId     : 'qrmTags',
			stateEvents : [ 'collapse' ],
			getState    : function() { return { value: this.getValue() }; },
			applyState  : function(state) { this.setValue(state.value); }
		},{
			xtype : 'container',
			id    : 'selected_tags'
		},{
			xtype      : 'rallyiterationcombobox',
			id         : 'iterPicker',
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
		defaults    : {
			autoScroll : true
		},
		items       : [
			{ title : 'Track'           },
			{ title : 'Burndown'        },
			{ title : 'Burnup'          },
			{ title : 'Cumulative Flow' }
		]
	}],

    launch: function() {
    	Ext.getBody().mask('Loading...');
    	Ext.state.Manager.setProvider(new Ext.state.LocalStorageProvider());
    	App = this;
    	App.down('#tag_filter').on({
    		blur: function() {
				this.collapse();
			},
			selectionchange : function() {
				App.UserInterface.TagFilter.isChanged = true;
			},
			collapse : function() {
				if (App.UserInterface.TagFilter.isChanged) {
					App.down('#viewport').getActiveTab().removeAll();
					App.UserInterface.TagFilter.update();
					App.Viewport.newQuery();
				}
			},
			added : function() {
				App.UserInterface.TagFilter.update();
			}
    	});
    	App.down('#iterPicker').on({
			change : function() {
				App.down('#viewport').getActiveTab().removeAll();
				App.Viewport.newQuery();
			}
    	});
    	App.down('#viewport').on({
    		beforetabchange : function() {
    			App.down('#viewport').getActiveTab().removeAll();
    		},
    		tabchange : App.Viewport.drawTab,
			resize  : function() {
				if (App.down('#chart')) {
					App.down('#chart').setWidth(Ext.get('viewport').getWidth() - 30);
					App.down('#chart').setHeight(Ext.get('viewport').getHeight() - 40);
	    		}
			}
    	});
    },

    UserInterface: {
    	ReleasePicker: {
    		init: function() {
    			var initializing = true;
    			Ext.create('Ext.Container', {
				    items: [{
				        xtype: 'rallyattributecombobox',
				        model: 'UserStory',
				        field: 'QuarterlyRelease',
				        listeners: {
				        	added: function() {
				        		var me    = this,
				        			nodes = [];
								dataWait();
				        		function dataWait() {
				        			if (me.store.data.items.length) {
				        				Ext.Array.each(me.store.data.items, function(i) {
				        					if (i.data.name != '-- No Entry --') {
				        						nodes.push({
													name  : i.data.name.split(' : ')[0],
													date  : i.data.name.split(' : ')[1],
													value : i.data.name
				        						});
				        					}
				        				});

				        				nodes.sort(function(a, b) {
											return a['date'] < b['date'] ? 1 : a['date'] > b['date'] ? -1 : 0;
										});

				        				App.down('#releasePickerContainer').add({
											xtype          : 'combo',
											id             : 'releasePicker',
											fieldLabel     : 'Release',
											width          : 250,
											labelWidth     : 50,
											labelAlign     : 'right',
											editable       : false,
											forceSelection : true,
											queryMode      : 'local',
											valueField     : 'value',
											stateful       : true,
											stateId        : 'qrm_release',
											stateEvents    : [ 'change' ],
											getState: function() {
												return {
													value: this.getValue()
												};
											},
											applyState: function(state) {
												this.setValue(state.value);
											},
											tpl            : Ext.create('Ext.XTemplate','<tpl for=".">','<div class="x-boundlist-item"><div class="releaseName">{name}</div><div class="releaseDate">{date}</div></div>','</tpl>'),
											displayTpl     : Ext.create('Ext.XTemplate','<tpl for=".">','{name}','</tpl>'),
											store          : {
							                    fields: ['value','name','date'],
							                    data: nodes
							                },
										    listeners: {
										    	change: function() {
										    		if (!initializing) App.Viewport.newQuery();
										    	},
										    	afterrender: function() {
										    		App.down('#releasePicker').select(nodes[0].value);
										    		App.Viewport.newQuery();
										    	}
										    }
				        				});
										initializing = false;
				        			} else {
				        				setTimeout(dataWait, 50);
				        			}
				        		}
				        	}
				        }
				    }]
				});	
    		}()
    	},
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
					border : 0,
					html   : selectedTagsText
		        });
	    	}
	    }
    },

    Viewport: {
    	wsStore : [],
    	lbStore : [],
    	newQuery: function() {
    		Ext.getBody().mask('Loading...');
    		// Clear existing stores
    		App.Viewport.wsStore = [];
    		App.Viewport.lbStore = [];
    		
    		//Fill stores
    		fillWsStore(function() {
    			fillLbStore(function() {
    				App.Viewport.lbStore = App.Viewport.lbStore.sort(function(a, b) {
    					return a['date'] > b['date'] ? 1 : a['date'] < b['date'] ? -1 : 0;
    				});
    				//Do stats
    				Ext.Array.each(App.Viewport.lbStore, function(n, k) {
    					n['Remaining Hours'] = 0;
						n['Total Scope']     = 0;
						n['Initial Version'] = 0;
						n['Defined']         = 0;
						n['In-Progress']     = 0;
						n['Completed']       = 0;
						n['Accepted']        = 0;
						Ext.Array.each(n.stories, function(s) {
							if (s.ScheduleState && s.PlanEstimate) {
								n[s.ScheduleState] += s.PlanEstimate;
								n['Total Scope']   += s.PlanEstimate;
							}
							if (s.TaskRemainingTotal) n['Remaining Hours'] += s.TaskRemainingTotal;
						});
    				});
    				//Calculate ideal hours trend
    				var hoursStep = 0;
    				var eligableNodes = 0;
    				Ext.Array.each(App.Viewport.lbStore, function(n) {
    					if (n['date'] < Rally.util.DateTime.toIsoString(new Date())) {
    						hoursStep += n['Remaining Hours'];
    						eligableNodes++;
    					}
    				});
    				var hoursStep = Math.ceil(parseInt((hoursStep / eligableNodes) * 1.5) / App.Viewport.lbStore.length);
    				var idealHours = 0;
    				Ext.Array.each(App.Viewport.lbStore, function(n) {
    					n['Ideal'] = idealHours;
    					idealHours += hoursStep;
    				}, this, true);
    				//Remove entries at a future date
    				Ext.Array.each(App.Viewport.lbStore, function(n, k) {
    					if (n['date'] > Rally.util.DateTime.toIsoString(new Date())) Ext.Array.erase(App.Viewport.lbStore, k, 1);
    				}, this, true);
    				App.Viewport.drawTab();
    			});
    		});

    		function fillWsStore(callback) {
    			// Create the filter object
	    		var filter = new Rally.data.QueryFilter({
	    			property: 'QuarterlyRelease', value: App.down('#releasePicker').getValue()
	    		});
	    		Ext.Array.each(App.down('#tag_filter').getValue(), function(tag) {
					filter = filter.and(new Rally.data.QueryFilter({
						property: 'Tags.Name', operator: 'contains', value: tag._refObjectName
					}));
				});
				// Load data into the store
	    		var wsLoader = Ext.create('Rally.data.WsapiDataStore', {
	    			model: 'UserStory',
	    			filters: filter,
	    			fetch: [
	    				'Iteration',
	    				'FormattedID',
	    				'Name',
	    				'ObjectID',
	    				'Owner',
	    				'PlanEstimate',
	    				'Project',
	    				'ScheduleState',
	    				'TaskEstimateTotal',
	    				'TaskRemainingTotal'
	    			],
	    			listeners: {
	    				load: function(store, data) {
	    					if (data && data.length) {
		    					Ext.Array.each(data, function(s) {
									s.raw.State         = Ext.Array.indexOf(['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'], s.raw.ScheduleState);
									s.raw.Team          = (s.raw.Project)   ? s.raw.Project._refObjectName   : '';
									s.raw.OwnerName     = (s.raw.Owner)     ? s.raw.Owner._refObjectName     : '';
									s.raw.IterationName = (s.raw.Iteration) ? s.raw.Iteration._refObjectName : '';
		    						App.Viewport.wsStore.push(s.raw);
		    					});
		    					wsLoader.nextPage();
	    					} else {
	    						callback();
	    					}
	    				}
	    			}
	    		});
	    		wsLoader.loadPage(1);
    		}
    		
    		function fillLbStore(callback) {
    			// Generate array of query dates based on iteration timeframe
				var aDate    = new Date(App.down('#iterPicker').getRecord().get('StartDate'));
				var bDate    = new Date(App.down('#iterPicker').getRecord().get('EndDate'));
	    		while (aDate < bDate) {
	    			App.Viewport.lbStore.push({
						date    : Rally.util.DateTime.toIsoString(aDate),
						dateStr : Rally.util.DateTime.toIsoString(aDate).substring(0,10)
	    			});
	    			aDate = Ext.Date.add(aDate, Ext.Date.DAY, 1);
	    		}
	    		var remaining = App.Viewport.lbStore.length;
	    		Ext.Array.each(App.Viewport.lbStore, function(i) {
	    			getDataOn(i.date, function(stories) {
	    				i.stories = stories;
	    				if (!--remaining) callback();
	    			});
	    		});

	    		function getDataOn(date, callback) {
	    			Ext.create('Rally.data.lookback.SnapshotStore', {
	    				autoLoad: true,
		    			pageSize: 10000,
		    			fetch: ['TaskRemainingTotal','PlanEstimate','c_QuarterlyRelease','ScheduleState'],
		    			hydrate: ['ScheduleState'],
		    			filters: [
		    			    { property: 'c_QuarterlyRelease', value: App.down('#releasePicker').getValue() },
		    			    { property: 'Children',           value: null                                  }, // Only leaf stories
		    				{ property: '__At',               value: date                                  }, // Specify the query date
		    				{ property: '_TypeHierarchy',     value: 'HierarchicalRequirement'             }  // Specify the type of User Story
		    			],
		                listeners: {
		                	load: function(store, data, success) {
		                		var stories = [];
		                		Ext.Array.each(data, function(s) {
		                			stories.push(s.raw);
		                		});
		                		callback(stories);
		                	}
		                }
	    			});
	    		}
    		}
    	},
    	drawTab: function() {
    		Ext.getBody().unmask();
    		var activeTab = App.down('#viewport').items.findIndex('id', App.down('#viewport').getActiveTab().id);
    		if (activeTab == 0) {
    			App.down('#iterPicker').hide();
    			App.down('#tag_filter').show();
    			App.down('#selected_tags').show();
    		} else {
    			App.down('#iterPicker').show();
    			App.down('#tag_filter').hide();
    			App.down('#selected_tags').hide();
    		}
    		var renderFunctions = [
    			function() { // Track
    				App.down('#viewport').getActiveTab().add({
						xtype             : 'rallygrid',
						disableSelection  : true,
						showPagingToolbar : false,
						store: Ext.create('Rally.data.custom.Store', {
							data       : App.Viewport.wsStore,
							groupField : 'Team',
							pageSize   : 1000,
							sorters    : [
								{ property: 'Team',          direction: 'ASC'  },
								{ property: 'IterationName', direction: 'DESC' },
								{ property: 'State',         direction: 'ASC' }
							]
						}),
						features: [Ext.create('Ext.grid.feature.Grouping', {
				        	groupHeaderTpl: '{name} ({rows.length} User Stor{[values.rows.length > 1 ? "ies" : "y"]})'
				   		})],
						columnCfgs: [{
							text      : 'ID',
							dataIndex : 'FormattedID',
							width     : 60,
							renderer  : function(val, meta, record) {
								return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('OID') + '">' + val + '</a>';
							}
						},{
							text      : 'Name',
							dataIndex : 'Name',
							flex      : 1,
							minWidth  : 150
						},{
							text      : 'Iteration',
							dataIndex : 'IterationName',
							width     : 175,
							align     : 'center'
						},{
							text      : 'State',
							dataIndex : 'State',
							width     : 85,
							align     : 'center',
							renderer  : function(val) {
								return ['Initial Version', 'Defined', 'In-Progress', 'Completed', 'Accepted'][val];
							}
						},{
							text      : 'Task Est',
							dataIndex : 'TaskEstimateTotal',
							width     : 60,
							align     : 'center'
						},{
							text      : 'To Do',
							dataIndex : 'TaskRemainingTotal',
							width     : 60,
							align     : 'center'
						},{
							text      : 'Plan Estimate',
							dataIndex : 'PlanEstimate',
							width     : 85,
							align     : 'center'
						},{
							text      : 'Owner',
							dataIndex : 'OwnerName',
							width     : 150,
							align     : 'center'
						}]
					});
    			},
    			function() { // Burndown
    				App.down('#viewport').getActiveTab().add({
						xtype   : 'chart',
						id      : 'chart',
						width   : Ext.get('viewport').getWidth()  - 30,
						height  : Ext.get('viewport').getHeight() - 40,
						margin  : '10 0 0 10',
						animate : true,
						legend  : { position: 'right' },
						store   : Ext.create('Ext.data.JsonStore', {
					        fields : ['dateStr','Remaining Hours','Ideal'],
					        data   : App.Viewport.lbStore
					    }),
					    axes: [{
			                type: 'Numeric',
			                position: 'left',
			                fields: ['Remaining Hours','Ideal'],
			                title: 'Hours',
			                grid: true
			            },{
							type     : 'Category',
							position : 'bottom',
							fields   : ['dateStr'],
							title    : 'Date'
					    }],
			            series: [{
			                type: 'column',
			                axis: 'left',
			                xField: 'dateStr',
			                yField: ['Remaining Hours'],
			                renderer: function(sprite, record, attr, index, store) {
							    return Ext.apply(attr, {
							        fill: 'rgb(92,154,203)'
							    });
							},
							style: {
								fill: '#5C9ACB'
							}
			            },{
			                type: 'line',
			                axis: 'left',
			                xField: 'dateStr',
			                yField: 'Ideal',
			                markerConfig: {
			                    type: 'circle',
			                    size: 3,
			                    stroke: '#000',
			                    fill: '#FFF'
			                },
			                style: {
			                	stroke: '#000',
			                	'stroke-width': 2,
			                }
			            }]
			        });
    			},
    			function() { // Burnup
    				App.down('#viewport').getActiveTab().add({
						xtype   : 'chart',
						id      : 'chart',
						width   : Ext.get('viewport').getWidth()  - 30,
						height  : Ext.get('viewport').getHeight() - 40,
						margin  : '10 0 0 10',
						animate : true,
						legend  : { position: 'right' },
						store   : Ext.create('Ext.data.JsonStore', {
					        fields : ['dateStr','Accepted','Total Scope'],
					        data   : App.Viewport.lbStore
					    }),
					    axes: [{
			                type: 'Numeric',
			                position: 'left',
			                fields: ['Accepted','Total Scope'],
			                title: 'Plan Estimate',
			                grid: true
			            },{
							type     : 'Category',
							position : 'bottom',
							fields   : ['dateStr'],
							title    : 'Date'
					    }],
			            series: [{
			                type: 'column',
			                axis: 'left',
			                xField: 'dateStr',
			                yField: 'Accepted',
			                renderer: function(sprite, record, attr, index, store) {
							    return Ext.apply(attr, {
							        fill: 'rgb(92,154,203)'
							    });
							},
							style: {
								fill: '#5C9ACB'
							}
			            },{
			                type: 'line',
			                axis: 'left',
			                xField: 'dateStr',
			                yField: 'Total Scope',
			                markerConfig: {
			                    type: 'circle',
			                    size: 3,
			                    stroke: '#000',
			                    fill: '#FFF'
			                },
			                style: {
			                	stroke: '#000',
			                	'stroke-width': 2,
			                }
			            }]
			        });
    			},
    			function() { // Cumulative Flow
    				App.down('#viewport').getActiveTab().add({
						xtype   : 'chart',
						id      : 'chart',
						width   : Ext.get('viewport').getWidth()  - 30,
						height  : Ext.get('viewport').getHeight() - 40,
						margin  : '10 0 0 10',
						animate : true,
						legend  : { position: 'right' },
						store   : Ext.create('Ext.data.JsonStore', {
					        fields : ['dateStr','Initial Version','Defined','In-Progress','Completed','Accepted'],
					        data   : App.Viewport.lbStore
					    }),
					    axes: [{
							type           : 'Numeric',
							position       : 'left',
							fields         : ['Accepted','Completed','In-Progress','Defined','Initial Version'],
							label          : { renderer : Ext.util.Format.numberRenderer('0,0') },
							grid           : true,
							minimum        : 0,
							majorTickSteps : 10,
							title          : 'Plan Estimate'
					    }, {
							type     : 'Category',
							position : 'bottom',
							fields   : ['dateStr'],
							title    : 'Date'
					    }],
					    series: [{
							type      : 'area',
							highlight : false,
							axis      : 'left',
							xField    : 'dateStr',
							yField    : ['Accepted','Completed','In-Progress','Defined','Initial Version'],
							style     : { opacity: 0.9 }
					    }]
					});
    			}
    		];
    		renderFunctions[activeTab]();
    	}
    }

});