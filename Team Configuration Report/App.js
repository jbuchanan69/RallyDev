Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

layout:'border',
	defaults: {
		collapsed   : false,
		autoScroll  : true,
		split       : true
	},
	items: [{
	    title       : 'Settings',
	    id          : 'popout',
	    region      : 'west',
	    margins     : '5 0 0 0',
	    width       : 300,
		layout: {
			type  : 'vbox',
			align : 'stretch',
			pack  : 'start',
		},
		items: [{
			id     : 'projectTreeContainer', 
			layout : 'fit',
			border : 0,
			flex   : 1
	    },{
			id      : 'settingsPanel',
			layout  : 'vbox',
			height  : 45,
			border  : 0,
			padding : 10,
			style   : {
				border  : '1px solid #99BCE8'
			},
			defaults: {
				width      : 300,
				labelWidth : 75
			},
			items: [{
				xtype      : 'spinnerfield',
				fieldLabel : 'Lookback:',
				id         : 'lookback',
				value      : '21 Days',
				width      : 261,
				labelWidth : 91,
				onSpinUp: function() {
			        this.setValue((parseInt(this.getValue().split(' ')[0]) + 1) + ' Days');
			    },
			    onSpinDown: function() {
			        var val = parseInt(this.getValue().split(' ')[0]) - 1;
			        if (val > 0) this.setValue(val + ((val == 1) ? ' Day' : ' Days'));
			        else Ext.Msg.alert('Error', 'Query date range must be a positive integer range.')
			    }
			}]
		}]
	},{
		id      : 'viewport',
		region  : 'center',
		margins : '5 0 0 0'
	}],

	launch: function() {
		App = this;
		App.projectTree.init();
		App.down('#viewport').addListener('resize', function() {
			if (App.popup) {
				App.popup.setWidth(Ext.getBody().getWidth());
				App.popup.setHeight(Ext.getBody().getHeight());
			}
		});
	},

	projectTree: {
    	init: function() {
    		Ext.create('Rally.data.WsapiDataStore', {
    			autoLoad: true,
    			model: 'Project',
    			fetch: ['Children','Name','ObjectID'],
    			filters: [ { property: 'Parent', value: null } ],
    			listeners: {
    				load: function(model, roots) {
    					var nodes = [];
    					Ext.Array.each(roots, function(root) {
    						nodes.push({
								name : root.get('Name'),
								text : root.get('Name'),
								id   : root.get('ObjectID'),
								leaf : root.raw.Children == undefined || root.raw.Children.length == 0,
							});
    					});
    					//Add tree to UI element
						App.down('#projectTreeContainer').add({
							xtype        : 'treepanel',
							id           : 'projectTree',
							rootVisible  : false,
							margin       : '-1 0 0 0',
							store        : Ext.create('Ext.data.TreeStore', {
								root: {
									expanded : true,
									children : nodes
								}
							}),
							listeners: {
								beforeitemexpand: function(node) {
									nodes = [];
									var childLoader = Ext.create('Rally.data.WsapiDataStore', {
										model: 'Project',
										fetch: ['Children','Name','ObjectID'],
										filters: [ { property: 'Parent.ObjectID', value: node.get('id') } ],
										listeners: {
											load: function(model, children) {
												Ext.Array.each(children, function(child) {
													nodes.push({
														name : child.get('Name'),
														text : child.get('Name'),
														id   : child.get('ObjectID'),
														leaf : child.raw.Children == undefined || child.raw.Children.length == 0
													});
												});
											}
										}
									});
									if (node.hasChildNodes() == false) {
										childLoader.loadPages({
											callback: function() {
												Ext.Array.each(nodes.sort(function(a, b) {
													return a['name'] > b['name'] ? 1 : a['name'] < b['name'] ? -1 : 0;
												}), function(n) {
													node.appendChild(n);
												});
											}
										});
									}
								},
								itemclick: function() {
									Ext.onReady(function() {
						    			App.viewport.update();
						    		});
								}
							}
						});		
    				}
    			}
    		});
    	}
    },

    viewport: {
    	update: function() {
    		Ext.getBody().mask('Loading: 0%');
			var loadedCount = 0;
			var gridData    = {};
			var gridArray   = [];
    		// Use the WSAPI to get all User Stories within the selected project
    		var loader = Ext.create('Rally.data.WsapiDataStore', {
    			model: 'UserStory',
    			fetch: ['CreationDate','FormattedID','Name','ObjectID','Parent','PlanEstimate','PortfolioItem','Project','ScheduleState','Tags'],
    			context: {
    				project: '/project/' + App.down('#projectTree').getSelectionModel().getSelection()[0].data.id,
    				projectScopeDown: true
    			},
    			filters: [
    				{ property: 'CreationDate', operator: '>', value: Rally.util.DateTime.toIsoString(Ext.Date.add(new Date(), Ext.Date.DAY, parseInt(App.down('#lookback').getValue().split(' ')[0]) * -1)) }
    			],
    			listeners: {
    				load: function(store, data) {
    					if (data && data.length) {
	    					Ext.Array.each(data, function(s) {
	    						if (gridData[s.raw.Project.Name] == undefined)
	    							gridData[s.raw.Project.Name] = {
	    								Name            : s.raw.Project.Name,
										UserStories     : [],
										StoryCount      : 0,
										RPMGapCount     : 0,
										MissingEstCount : 0,
										MissingTagCount : 0
									}
	    						gridData[s.raw.Project.Name].UserStories.push(s.raw);
	    					});
	    					loadedCount += data.length;
	    					Ext.getBody().mask('Loading: ' + parseInt((loadedCount/store.totalCount) * 100) + '%');
	    					loader.nextPage();
	    				} else if (loader.currentPage == 1) {
	    					Ext.getBody().unmask();
	    					Ext.Msg.alert('Error', 'No User Stories found matching current search criteria.');
	    				} else {
    						for (p in gridData) {
		    					Ext.Array.each(gridData[p].UserStories, function(s) {
		    						if (s.Parent == null && s.PortfolioItem == null) {
		    							s.RPMGap = true;
		    							gridData[p].RPMGapCount++;
		    						}
		    						if (s.PlanEstimate == undefined) {
		    							s.MissingEst = true;
		    							gridData[p].MissingEstCount++;
		    						}
		    						if (s.Tags.length == 0) {
		    							s.MissingTag = true;
		    							gridData[p].MissingTagCount++;
		    						}
		    						gridData[p].StoryCount++;
		    					});
		    					gridData[p].RPMGapRate     = parseFloat(gridData[p].RPMGapCount / gridData[p].StoryCount);
		    					gridData[p].MissingEstRate = parseFloat(gridData[p].MissingEstCount / gridData[p].StoryCount);
		    					gridData[p].MissingTagRate = parseFloat(gridData[p].MissingTagCount / gridData[p].StoryCount);
		    					gridArray.push(gridData[p]);
		    				}
		    				Ext.getBody().unmask();
			    			
			    			App.down('#viewport').removeAll();
			    			App.down('#viewport').add({
								xtype: 'rallygrid',
								disableSelection: true,
								showPagingToolbar: false,
								store: Ext.create('Rally.data.custom.Store', {
									data     : gridArray,
									sorters  : [{
										property  : 'Name',
										direction : 'ASC'
									}],
									pageSize : 1000
								}),
								columnCfgs: [{
									text      : 'Team',
									dataIndex : 'Name',
									flex      : 1
								},{
									text      : 'User Stories',
									dataIndex : 'StoryCount',
									width     : 45,
									align     : 'center'
								},{
									text      : 'RPM Hookup Gaps',
									dataIndex : 'RPMGapRate',
									width     : 90,
									align     : 'center',
									renderer  : function(val, meta, record) {
										return '<div class="' + valToColor(val) + ' label"><div class="half">' + parseInt(val*100) + '%</div><div class="half">' + record.get('RPMGapCount') + '</div></div>';
									}
								},{
									text      : 'Missing Plan Estimates',
									dataIndex : 'MissingEstRate',
									width     : 90,
									align     : 'center',
									renderer  : function(val, meta, record) {
										return '<div class="' + valToColor(val) + ' label"><div class="half">' + parseInt(val*100) + '%</div><div class="half">' + record.get('MissingEstCount') + '</div></div>';
									}
								},{
									text      : 'Missing Tags',
									dataIndex : 'MissingTagRate',
									width     : 90,
									align     : 'center',
									renderer  : function(val, meta, record) {
										return '<div class="' + valToColor(val) + ' label"><div class="half">' + parseInt(val*100) + '%</div><div class="half">' + record.get('MissingTagCount') + '</div></div>';
									}
								}],
								listeners: {
									itemclick: function(view, record, item, index, evt) {
										var column = view.getPositionByEvent(evt).column;
										var storeConfig = [
											function() {
												null;
											},
											function() {
												drawPopup(Ext.create('Rally.data.custom.Store', {
													data     : record.data.UserStories,
													fields    : ['FormattedID','Name','ObjectID','PlanEstimate','ScheduleState'],
													sorters  : [{ property: 'Name', direction: 'ASC' }],
													pageSize : 1000
												}));
											},
											function() {
												drawPopup(Ext.create('Rally.data.custom.Store', {
													data      : record.data.UserStories,
													fields    : ['FormattedID','Name','ObjectID','RPMGap','PlanEstimate','ScheduleState'],
													sorters   : [{ property: 'Name', direction: 'ASC' }],
													filters   : [{ property: 'RPMGap', value: true }],
													pageSize  : 1000
												}));
											},
											function() {
												drawPopup(Ext.create('Rally.data.custom.Store', {
													data     : record.data.UserStories,
													fields   : ['FormattedID','Name','MissingEst','ObjectID','PlanEstimate','ScheduleState'],
													sorters  : [{ property: 'Name', direction: 'ASC' }],
													filters  : [{ property: 'MissingEst', value: true }],
													pageSize : 1000
												}));
											},
											function() {
												drawPopup(Ext.create('Rally.data.custom.Store', {
													data     : record.data.UserStories,
													fields   : ['FormattedID','Name','MissingTag','ObjectID','PlanEstimate','ScheduleState'],
													sorters  : [{ property: 'Name', direction: 'ASC' }],
													filters  : [{ property: 'MissingTag', value: true }],
													pageSize : 1000
												}));
											}
										];
										storeConfig[column]();
										
										function drawPopup(popup_store) {
											App.popup = Ext.create('Rally.ui.dialog.Dialog', {
												autoShow   : true,
												width      : Ext.getBody().getWidth(),
												height     : Ext.getBody().getHeight(),
												autoScroll : true,
												closable   : true,
												items: [{
													xtype             : 'rallygrid',
													layout            : 'fit',
													showPagingToolbar : false,
													disableSelection  : true,
													columnCfgs        : [
														{ text: 'ID',            dataIndex: 'FormattedID',   width: 60, renderer: function(val, meta, record) { return '<a href="https://rally1.rallydev.com/#/detail/userstory/' + record.get('ObjectID') + '" target="_blank">' + val + '</a>'; }},
														{ text: 'Name',          dataIndex: 'Name',          flex: 1                     },
														{ text: 'Plan Estimate', dataIndex: 'PlanEstimate',  width: 100, align: 'center' },
														{ text: 'State',         dataIndex: 'ScheduleState', width: 100, align: 'center' }
													],
													store : popup_store
												}],
												listeners: {
													afterrender: function() {
														this.toFront();
														this.focus();
													}
												}
											});
										}
										
									}
								}
							});

							function valToColor(val) {
								return (val == 0) ? 'green' : (val < .25) ? 'yellow' : 'red';
							}
	    				}
    				}
    			}
    		});
    		loader.loadPage(1);
    	}
    }
});