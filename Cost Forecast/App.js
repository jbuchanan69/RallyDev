// Cost Forecast - Version 3.2
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    alias: 'widget.myapp', //Fix crash in prod bug

    layout:'border',
	defaults: {
		collapsible : true,
		collapsed   : false,
		split       : true,
		autoScroll  : true
	},
	items: [{
	    title       : 'Projects',
	    id          : 'leftPopout',
	    region      : 'west',
	    margins     : '5 0 0 0',
	    width       : 350,
	    layout      : 'fit'
	},{
		id          : 'viewport',
    	collapsible : false,
    	region      : 'center',
    	margins     : '5 0 0 0'
	},{
	    title       : 'Settings',
	    id          : 'rightPopout',
	    region      : 'east',
	    margins     : '5 0 0 0',
	    width       : 270
	}],

    launch: function() {
    	Ext.state.Manager.setProvider(new Ext.state.LocalStorageProvider());
    	App = this;
    	Ext.getBody().mask('Initializing UI...');
    	App.rpmTree.init();
    	App.settingsPanel.init();
    	// App.getFteCounts(); //Re-enable when Team Member assignments are fixed
    },

    storyData: {},
    velocityData: {},
    fteData: {},

    getFteCounts: function() {
    	var fteLoader = Ext.create('Rally.data.WsapiDataStore', {
			model: 'Project',
			fetch: ['Name', 'TeamMembers', 'FirstName', 'LastName'],
			context: this.getContext().getDataContext(),
			listeners: {
				load: function(store, data) {
					Ext.Array.each(data, function(team) {
						App.fteData[team.get('Name')] = team.get('TeamMembers').length;
					});
				}
			}
		});
		fteLoader.loadPages({
			callback: function() {null;}
		});
    },

rpmTree: {
		init: function() {
			Ext.create('Rally.data.WsapiDataStore', {
	            autoLoad: true,
	            model: 'PortfolioItem/Initiative',
	            fetch: ['Children','LeafStoryCount','Name','ObjectID'],
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
				App.down('#leftPopout').add({
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
									autoLoad: true,
									model: 'PortfolioItem/' + child_type,
									filters: [{
										property: 'Parent.ObjectID',
										value: node.raw.id
									}],
									fetch: ['Children','LeafStoryCount','Name','ObjectID'],
									listeners: {
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
		iterations : [],
		gridArray  : [],
    	update: function() {
    		App.down('#viewport').removeAll();
			App.viewport.iterations = [];
			App.viewport.gridArray  = [];
			var filter              = [];
			var qCount              = 0;
			var descendantOIDs      = [];

			Ext.create('Rally.data.lookback.SnapshotStore', {
    			autoLoad: true,
    			pageSize: 10000,
    			filters: [{
    				property : '__At',
    				value    : 'current'
    			},{
    				property : '_TypeHierarchy',
    				value    : 'HierarchicalRequirement'
    			},{
    				property : '_ItemHierarchy',
    				value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
    			},{
    				property : 'Children',
    				value    : null
    			}],
    			fetch: ['ObjectID'],
    			listeners: {
    				load: function(store, data, success) {
    					console.log(success);
    					Ext.Array.each(data, function(s) {
    						descendantOIDs.push(s.raw.ObjectID);
    					});
    					var leftToLoad = descendantOIDs.length;
			    		if (descendantOIDs.length > 0) {
			    			Ext.getBody().mask('Parsing ' + descendantOIDs.length + ' User Stories...');
				    		Ext.Array.each(descendantOIDs, function(OID, key) {
				    			if (App.storyData[OID] == undefined) {
					    			filter.push({
										property : 'ObjectID',
										value    : OID
									});
					    		}
				    			if (filter.length == 50 || key == descendantOIDs.length - 1) {
				    				qCount++;
				    				getDetails(filter);
				    				filter = [];
				    			}
				    		});
			    		}
    				}
    			}
    		});

    		function getDetails(filter) {
    			var taskOwners;
    			if (filter.length > 0) {
    				var detailLoader = Ext.create('Rally.data.WsapiDataStore', {
	    				model: 'UserStory',
	    				context: {
							project: '/project/' + 2147979614,
							projectScopeDown: true
						},
	    				fetch: ['Iteration','Name','ObjectID','Project','Tasks','Owner','PlanEstimate','StartDate'],
	    				filters: Rally.data.QueryFilter.or(filter),
	    				listeners: {
	    					load: function(model, data) {
	    						Ext.Array.each(data, function(story, key) {
	    							taskOwners = [];
	    							Ext.Array.each(story.get('Tasks'), function(task) {
	    								if (task.Owner && Ext.Array.indexOf(taskOwners, task.Owner.ObjectID) == -1) {
	    									taskOwners.push(task.Owner.ObjectID);
	    								}
	    							});
	    							App.storyData[story.get('ObjectID')] = {
										Name       : story.get('Name'),
										Project    : story.get('Project'),
										Points     : story.get('PlanEstimate') || 0,
										Iteration  : story.get('Iteration'),
										TaskOwners : taskOwners
	    							};
	    						});
	    					}
	    				}
	    			});
    				detailLoader.loadPages({callback: onDetails});
    			} else {
    				onDetails();
    			}
    		}

    		function onDetails() {
    			if (--qCount == 0) {
    				var story,
    					node, 
    					detailStartTime,
    					detailEndTime,
    					storyTime;
					var gridObj = {};
	    			Ext.Array.each(descendantOIDs, function(OID) {
	    				//Make sure project node exists
	    				if (App.storyData[OID] != undefined) {
	    					if (gridObj[App.storyData[OID].Project.Name] == undefined) {
		    					gridObj[App.storyData[OID].Project.Name] = {
		    						Name             : App.storyData[OID].Project.Name,
		    						OID              : App.storyData[OID].Project.ObjectID,
									PastIterPoints   : 0,
									FutureIterPoints : 0,
									BacklogPoints    : 0,
									PastIterCount    : 0,
									FutureIterCount  : 0,
									BacklogCount     : 0,
									TotalCost        : 0,
									TotalPoints      : 0,
									TotalHours       : 0,
									TotalCount       : 0,
									UnestimatedCount : 0,
									TaskOwners       : [],
		    					};
		    				}

		    				//Save references
							story           = App.storyData[OID];
							node            = gridObj[story.Project.Name];
							detailStartTime = App.down('#detailStart').getRecord().get('StartDate').getTime();
							detailEndTime   = App.down('#detailEnd').getRecord().get('StartDate').getTime();

							//Add points to node
							if (story.Points == 0) node.UnestimatedCount++;
							if (story.Iteration) {
								storyTime = new Date(story.Iteration.StartDate).getTime();
								if (storyTime < detailStartTime) {
									node.PastIterPoints += story.Points;
									node.PastIterCount++;
								} else if (storyTime > detailEndTime) {
									node.FutureIterPoints += story.Points;
									node.FutureIterCount++;
								} else {
									node[story.Iteration.Name + 'Points'] == undefined ? node[story.Iteration.Name + 'Points'] = story.Points : node[story.Iteration.Name + 'Points'] += story.Points;
									node[story.Iteration.Name + 'Count'] == undefined ? node[story.Iteration.Name + 'Count'] = 1 : node[story.Iteration.Name + 'Count']++;
									if (Ext.Array.indexOf(App.viewport.iterations, story.Iteration.Name) == -1) App.viewport.iterations.push(story.Iteration.Name);
								}
							} else {
								node.BacklogPoints += story.Points;
								node.BacklogCount++;
							}
							
							//Add task owners
		    				Ext.Array.each(story.TaskOwners, function(owner) {
		    					if (Ext.Array.indexOf(node.TaskOwners, owner) == -1) node.TaskOwners.push(owner);
		    				});
	    				}
	    			});

					//Load total points for cost calculation
					for (team in gridObj) { App.viewport.gridArray.push(gridObj[team]); }
					qCount = 0;
					var costPerPoint;
					Ext.Array.each(App.viewport.gridArray, function(team) {
						if (App.fteData[team.Name] == undefined) App.fteData[team.Name] = team.TaskOwners.length || 0;
						team.FTECount = App.fteData[team.Name];
						if (App.velocityData[team.Name] == undefined) {
							getVelocity(team.OID, function(points) {
								App.velocityData[team.Name] = parseFloat(points.toFixed(2)) || 0;
								team.Velocity = App.velocityData[team.Name];
								if (++qCount == App.viewport.gridArray.length) App.viewport.drawGrid();
							});
						} else {
							team.Velocity = App.velocityData[team.Name];
							if (++qCount == App.viewport.gridArray.length) App.viewport.drawGrid();
						}
					});
    			}
    		}

    		function getVelocity(OID, callback) {
    			Ext.create('Rally.data.lookback.SnapshotStore', {
	    			autoLoad: true,
	    			pageSize: 1000000,
	    			fetch: ['PlanEstimate','Iteration'],
	    			filters: [
	    			    { property: 'Project',                        value: OID                       },
	    			    { property: 'Iteration',      operator: '!=', value: null                      },
	    			    { property: 'PlanEstimate',   operator: '>',  value: 0                         },
	    			    { property: 'ScheduleState',                  value: 'Accepted'                },
	    				{ property: '__At',                           value: new Date().toISOString()  },
	    				{ property: '_TypeHierarchy',                 value: 'HierarchicalRequirement' }
	    			],
	                listeners: {
	                	load: function(model, data, success) {
	                		if (data && data.length && success) {
	                			var points = 0;
	                			var iterations = [];
		                		Ext.Array.each(data, function(story) {
		                			if (App.down('#velocity_method').getValue() == 'All Projects' || Ext.Array.indexOf(descendantOIDs, story.get('ObjectID')) != -1) {
		                				iterations.push(story.get('Iteration'));
		                				points += story.get('PlanEstimate');
		                			}
		                		});
	                			callback(points / Ext.Array.unique(iterations).length);
	                		} else {
	                			callback(0);
	                		}
	                	}
	                }
	            });
    		}
    	},

    	drawGrid: function() {
    		App.down('#viewport').removeAll();
			var gridSettings = App.settingsPanel.getCheckedBoxes();
			var columnSums = {};
			//Configure grid columns based on user settings
			var columns = [{
				text: 'Team', flex: 1, renderer: function(value, meta, record, row, col) {
					//Clear totals (Ghetto fix but it works...)
					record.data.TotalCost   = 0;
					record.data.TotalPoints = 0;
					record.data.TotalHours  = 0;
					record.data.TotalCount  = 0;
					return record.get('Name');
				}, summaryType: function() {
					var summaryString = '';
					var spaces = 0;
					if (Ext.Array.indexOf(gridSettings, 'row_sum') != -1) {
						summaryString += '<div class="summary">Sum:</div>';
						if (Ext.Array.indexOf(gridSettings, 'cost')   != -1) spaces++;
						if (Ext.Array.indexOf(gridSettings, 'points') != -1) spaces++; 
						if (Ext.Array.indexOf(gridSettings, 'hours')  != -1) spaces++;
						if (Ext.Array.indexOf(gridSettings, 'count')  != -1) spaces++;
						while (--spaces > 0) summaryString += '<div>&nbsp</div>';
						summaryString += '<br />';
					}
					if (Ext.Array.indexOf(gridSettings, 'row_avg') != -1) {
						spaces = 0;
						summaryString += '<div class="summary">Average:</div>';
						if (Ext.Array.indexOf(gridSettings, 'cost')   != -1) spaces++;
						if (Ext.Array.indexOf(gridSettings, 'points') != -1) spaces++;
						if (Ext.Array.indexOf(gridSettings, 'hours')  != -1) spaces++;
						if (Ext.Array.indexOf(gridSettings, 'count')  != -1) spaces++;
						while (--spaces > 0) summaryString += '<div>&nbsp</div>';
					}
					return summaryString;
				}
			}];
			if (Ext.Array.indexOf(gridSettings, 'ftes') != -1) columns.push({
				text: 'FTEs',
				dataIndex: 'FTECount',
				width: 60,
				editor: {
	                xtype: 'numberfield',
	                clicksToEdit: 1,
	                allowBlank: false,
	                minValue: 0,
	                maxValue: 100,
	                listeners: {
	                	change: function(spinner, val) {
	                		App.fteData[store.getAt(selectedRow).raw.Name] = val;
	                	},
	                	blur: function() {
	                		setTimeout(function() {
	                			App.viewport.update();
	                		}, 10);
	                	}
	                }
	            }
			});
			if (Ext.Array.indexOf(gridSettings, 'velocity') != -1) columns.push({
				text: 'Velocity', width: 60, dataIndex: 'Velocity'
			});
			if (Ext.Array.indexOf(gridSettings, 'cpp') != -1) columns.push({
				text: 'Cost Per Point', width: 60, renderer: function(value, meta, record, row, col) {
					var costPerPoint = Math.round((App.down('#costPerHour').getValue() * App.down('#hoursPerIter').getValue() * record.get('FTECount')) / record.get('Velocity'));
					costPerPoint = isFinite(costPerPoint) ? Ext.util.Format.number(costPerPoint, '0,000') : 0;
					return '$' + costPerPoint;
				}
			});
			if (Ext.Array.indexOf(gridSettings, 'past') != -1) columns.push({
				text: 'Past Iterations', flex: 1, renderer: function(value, meta, record, row, col) {
					return formatDetail(record, 'PastIter');
				}, summaryType: function(records) {
					return formatSummary('PastIter');
				}
			});
			if (Ext.Array.indexOf(gridSettings, 'details') != -1) {
				Ext.Array.each(App.viewport.iterations.sort(), function(iter) {
					columns.push({
						text: iter, flex: 1, renderer: function(value, meta, record, row, col) {
							return formatDetail(record, iter);
						}, summaryType: function(records) {
							return formatSummary(iter);
						}
					});
				});
			}
			if (Ext.Array.indexOf(gridSettings, 'future') != -1) columns.push({
				text: 'Future Iterations', flex: 1, renderer: function(value, meta, record, row, col) {
					return formatDetail(record, 'FutureIter');
				}, summaryType: function(records) {
					return formatSummary('FutureIter');
				}
			});
			if (Ext.Array.indexOf(gridSettings, 'backlog') != -1) columns.push({
				text: 'Backlog', flex: 1, renderer: function(value, meta, record, row, col) {
					return formatDetail(record, 'Backlog');
				}, summaryType: function(records) {
					return formatSummary('Backlog');
				}
			});
			if (Ext.Array.indexOf(gridSettings, 'unestimated') != -1) columns.push({
				text: 'Unestimated Stories', flex: 1, renderer: function(value, meta, record, row, col) {
					return formatDetail(record, 'Unestimated');
				}, summaryType: function(records) {
					return formatSummary('Unestimated');
				}
			});
			if (Ext.Array.indexOf(gridSettings, 'col_sum') != -1) columns.push({
				text: 'Sum', flex: 1, renderer: function(value, meta, record) {
					var detailString = '';
					if (Ext.Array.indexOf(gridSettings, 'cost')   != -1) detailString += '<div><span class="icon" title="Cost">C</span><span class="summary">$'            + Ext.util.Format.number(record.get('TotalCost'), '0,000')   + '</div>';
					if (Ext.Array.indexOf(gridSettings, 'points') != -1) detailString += '<div><span class="icon" title="Points">P</span><span class="summary">'           + Ext.util.Format.number(record.get('TotalPoints'), '0,000') + '</div>';
					if (Ext.Array.indexOf(gridSettings, 'hours')  != -1) detailString += '<div><span class="icon" title="Hours">H</span><span class="summary">'            + Ext.util.Format.number(record.get('TotalHours'), '0,000')  + '</div>';
					if (Ext.Array.indexOf(gridSettings, 'count')  != -1) detailString += '<div><span class="icon" title="User Story Count">S</span><span class="summary">' + Ext.util.Format.number(record.get('TotalCount'), '0,000')  + '</div>';
					return detailString;
				}
			});
			//Have to explicitly set the field values in case the first object doesn't have all fields defined
			var fields = [
				'Name',
				'OID',
				'PastIterPoints',
				'FutureIterPoints',
				'BacklogPoints',
				'PastIterCount',
				'FutureIterCount',
				'BacklogCount',
				'UnestimatedCount',
				'TaskOwners',
				'TotalCost',
				'TotalPoints',
				'TotalHours',
				'TotalCount',
				'FTECount',
				'Velocity'
			];
			Ext.Array.each(App.viewport.iterations, function(iter) {
				fields.push(iter + 'Points');
				fields.push(iter + 'Count');
			});
			//Create the store using the data and field specs
			var store = Ext.create('Rally.data.custom.Store', {
				data     : App.viewport.gridArray,
				fields   : fields,
				pageSize : 25,
				sorters  : [
					{ property: 'Name', direction: 'ASC' }
				]
			});

			var selectedRow = 0;
			App.down('#viewport').add({
				xtype : 'rallygrid',
				disableSelection: true,
				store : store,
				id: 'teamGrid',
				columnCfgs : columns,
				features: [{
			        ftype: 'summary'
			    }],
				listeners: {
                    itemclick: function(view, record, item, index, evt) {
                        selectedRow = view.getPositionByEvent(evt).row;
                    }
                }
			});
			Ext.getBody().unmask();

			function formatSummary(field) {
				function buildString() {
					if (columnSums[field]) {
						var summaryString = '';
						var classString = 'class="icon'; (field == 'Unestimated') ? classString += ' est"' : classString += '"';
						if (Ext.Array.indexOf(gridSettings, 'row_sum') != -1) {
							if (Ext.Array.indexOf(gridSettings, 'cost')   != -1) summaryString += '<div><span ' + classString + ' title="Cost">C</span><span class="summary">$'            + Ext.util.Format.number(columnSums[field].cost, '0,000')   + '</span></div>';
							if (Ext.Array.indexOf(gridSettings, 'points') != -1) summaryString += '<div><span ' + classString + ' title="Points">P</span><span class="summary">'           + Ext.util.Format.number(columnSums[field].points, '0,000') + '</span></div>';
							if (Ext.Array.indexOf(gridSettings, 'hours')  != -1) summaryString += '<div><span ' + classString + ' title="Hours">H</span><span class="summary">'            + Ext.util.Format.number(columnSums[field].hours, '0,000')  + '</span></div>';
							if (Ext.Array.indexOf(gridSettings, 'count')  != -1) summaryString += '<div><span ' + classString + ' title="User Story Count">S</span><span class="summary">' + Ext.util.Format.number(columnSums[field].count, '0,000')  + '</span></div>';
							summaryString += '<br />';
						}
						if (Ext.Array.indexOf(gridSettings, 'row_avg') != -1) {
							if (Ext.Array.indexOf(gridSettings, 'cost')   != -1) summaryString += '<div><span ' + classString + ' title="Cost">C</span><span class="summary">$'            + Ext.util.Format.number(parseFloat(columnSums[field].cost / store.getTotalCount()).toFixed(2), '0,000')   + '</span></div>';
							if (Ext.Array.indexOf(gridSettings, 'points') != -1) summaryString += '<div><span ' + classString + ' title="Points">P</span><span class="summary">'           + Ext.util.Format.number(parseFloat(columnSums[field].points / store.getTotalCount()).toFixed(2), '0,000') + '</span></div>';
							if (Ext.Array.indexOf(gridSettings, 'hours')  != -1) summaryString += '<div><span ' + classString + ' title="Hours">H</span><span class="summary">'            + Ext.util.Format.number(parseFloat(columnSums[field].hours / store.getTotalCount()).toFixed(2), '0,000')  + '</span></div>';
							if (Ext.Array.indexOf(gridSettings, 'count')  != -1) summaryString += '<div><span ' + classString + ' title="User Story Count">S</span><span class="summary">' + Ext.util.Format.number(parseFloat(columnSums[field].count / store.getTotalCount()).toFixed(2), '0,000')  + '</span></div>';
						}
						return summaryString;
					} else {
						setTimeout(buildString, 100);
					}
				}
				return buildString();
			}

			function formatDetail(record, field) {
				record.data.CostPerPoint = Math.round((App.down('#costPerHour').getValue() * App.down('#hoursPerIter').getValue() * record.get('FTECount')) / record.get('Velocity'));
				if (!isFinite(record.data.CostPerPoint)) record.data.CostPerPoint = 0;
				//Calculate values
				var count = record.get(field + 'Count') || 0;
				if (field == 'Unestimated') var points = parseInt((record.get('TotalPoints') / record.get('TotalCount')) * count) || 0;
				else var points = record.get(field + 'Points') || 0;
				var cost  = points * record.data.CostPerPoint;
				var hours = (points * record.data.CostPerPoint) / App.down('#costPerHour').getValue();
				//Add values to sum
				record.data.TotalCost   += cost;
				record.data.TotalPoints += points;
				record.data.TotalHours  += hours;
				record.data.TotalCount  += count;
				//Add to column sums
				if (columnSums[field] == undefined) columnSums[field] = {
					cost   : 0,
					points : 0,
					hours  : 0,
					count  : 0
				};
				columnSums[field].cost   += cost;
				columnSums[field].points += points;
				columnSums[field].hours  += hours;
				columnSums[field].count  += count;
				//Detail string
				var detailString = '';
				var classString = 'class="icon'; (field == 'Unestimated') ? classString += ' est"' : classString += '"';
				if (Ext.Array.indexOf(gridSettings, 'cost')   != -1) detailString += '<div><span ' + classString + ' title="Cost">C</span>$'            + Ext.util.Format.number(cost, '0,000')   + '</div>';
				if (Ext.Array.indexOf(gridSettings, 'points') != -1) detailString += '<div><span ' + classString + ' title="Points">P</span>'           + Ext.util.Format.number(points, '0,000') + '</div>';
				if (Ext.Array.indexOf(gridSettings, 'hours')  != -1) detailString += '<div><span ' + classString + ' title="Hours">H</span>'            + Ext.util.Format.number(hours, '0,000')  + '</div>';
				if (Ext.Array.indexOf(gridSettings, 'count')  != -1) detailString += '<div><span ' + classString + ' title="User Story Count">S</span>' + Ext.util.Format.number(count, '0,000')  + '</div>';
				return detailString;
			}
		}
    },

    settingsPanel: {
    	init: function() {
    		var initializing = true;
    		App.down('#rightPopout').add({
    			border: 0,
    			padding: 5,
    			items: [{
					xtype       : 'rallyiterationcombobox',
					id          : 'detailStart',
					fieldLabel  : 'Detail Start:',
					labelWidth  : 60,
					width       : 300,
					listeners   : {
						change  : function() {
							App.viewport.update();
						}
					}
    			},{
					xtype       : 'rallyiterationcombobox',
					id          : 'detailEnd',
					fieldLabel  : 'Detail End:',
					labelWidth  : 60,
					width       : 300,
					listeners   : {
						change  : function() {
							App.viewport.update();
						}
					}
    			},{
					xtype       : 'checkboxgroup',
					id          : 'columns_group',
					fieldLabel  : 'Columns',
					labelWidth  : 74,
					columns     : 1,
					vertical    : true,
					stateful    : true,
					stateId     : 'cf_columns',
					stateEvents : [ 'change' ],
					getState: function() {
						return {
							value: this.getValue()
						};
					},
					applyState: function(state) {
						this.setValue(state.value);
					},
			        items: [ 
			        	{ boxLabel: 'FTE Count',           name: 'columns', inputValue: 'ftes',        checked: false },
			        	{ boxLabel: 'Velocity',            name: 'columns', inputValue: 'velocity',    checked: false },
			            { boxLabel: 'Cost Per Point',      name: 'columns', inputValue: 'cpp',         checked: false },
			            { boxLabel: 'Past Iterations',     name: 'columns', inputValue: 'past',        checked: true  },
			            { boxLabel: 'Detailed Iterations', name: 'columns', inputValue: 'details',     checked: true  },
			            { boxLabel: 'Future Iterations',   name: 'columns', inputValue: 'future',      checked: true  },
			            { boxLabel: 'Backlog',             name: 'columns', inputValue: 'backlog',     checked: true  },
			            { boxLabel: 'Unestimated Stories', name: 'columns', inputValue: 'unestimated', checked: false }
			        ],
					listeners   : {
						change  : function() {
							if (!initializing) App.viewport.drawGrid();
						}
					}
    			},{
					xtype       : 'checkboxgroup',
					id          : 'details_group',
					fieldLabel  : 'Details',
					labelWidth  : 74,
					columns     : 1,
					vertical    : true,
					stateful    : true,
					stateId     : 'cf_details',
					stateEvents : [ 'change' ],
					getState: function() {
						return {
							value: this.getValue()
						};
					},
					applyState: function(state) {
						this.setValue(state.value);
					},
			        items: [
			        	{ boxLabel: 'Cost',        name: 'details', inputValue: 'cost',   checked: true },
			            { boxLabel: 'Points',      name: 'details', inputValue: 'points', checked: true },
			            { boxLabel: 'Hours',       name: 'details', inputValue: 'hours',  checked: true },
			            { boxLabel: 'Story Count', name: 'details', inputValue: 'count',  checked: true }
			        ],
					listeners   : {
						change  : function() {
							if (!initializing) App.viewport.drawGrid();
						}
					}
    			},{
					xtype       : 'checkboxgroup',
					id          : 'stats_group',
					fieldLabel  : 'Statistics',
					labelWidth  : 74,
					columns     : 1,
					vertical    : true,
					stateful    : true,
					stateId     : 'cf_stats',
					stateEvents : [ 'change' ],
					getState: function() {
						return {
							value: this.getValue()
						};
					},
					applyState: function(state) {
						this.setValue(state.value);
					},
			        items: [
			            { boxLabel: 'Column Sum',  name: 'stats', inputValue: 'col_sum', checked: true },
			            { boxLabel: 'Row Sum',     name: 'stats', inputValue: 'row_sum', checked: true },
			            { boxLabel: 'Row Average', name: 'stats', inputValue: 'row_avg', checked: true }
			        ],
					listeners   : {
						change  : function() {
							if (!initializing) App.viewport.drawGrid();
						}
					}
    			},{
					xtype          : 'combo',
					id             : 'velocity_method',
					fieldLabel     : 'Velocity',
					labelWidth     : 78,
					editable       : false,
					forceSelection : true,
					queryMode      : 'local',
					displayField   : 'text',
					valueField     : 'text',
					value          : 'All Projects',
                    store: {
                        fields: ['text'],
                        data: [
                        	{ text: 'All Projects'           },
                        	{ text: 'Only Selected Projects' }
                        ]
                    },
                    listeners   : {
						change  : function() {
							App.velocityData = {};
							App.viewport.update();
						}
					}
                },{
					xtype       : 'numberfield',
					id          : 'costPerHour',
					fieldLabel  : 'Cost Per Hour',
					labelWidth  : 78,
					value       : 70,
					allowBlank  : false,
					minValue    : 1,
					stateful    : true,
					stateId     : 'cf_costperhour',
					stateEvents : [ 'change' ],
					getState: function() {
						return {
							value: this.getValue()
						};
					},
					applyState: function(state) {
						this.setValue(state.value);
					},
					listeners   : {
						change  : function() {
							if (!initializing) App.viewport.drawGrid();
						}
					}
    			},{
					xtype       : 'numberfield',
					id          : 'hoursPerIter',
					fieldLabel  : 'Hours Per Iteration',
					labelWidth  : 78,
					value       : 120,
					allowBlank  : false,
					minValue    : 1,
					stateful    : true,
					stateId     : 'cf_hoursperiter',
					stateEvents : [ 'change' ],
					getState: function() {
						return {
							value: this.getValue()
						};
					},
					applyState: function(state) {
						this.setValue(state.value);
					},
					listeners   : {
						change  : function() {
							if (!initializing) App.viewport.drawGrid();
						}
					}
    			}]
    		});
			initializing = false;
    	},

    	getCheckedBoxes: function() {
    		var checked = [];
    		Ext.Array.each(App.down('#columns_group').getValue().columns, function(p) { checked.push(p); });
    		Ext.Array.each(App.down('#details_group').getValue().details, function(p) { checked.push(p); });
    		Ext.Array.each(App.down('#stats_group').getValue().stats, function(p)     { checked.push(p); });
    		return checked;
    	}

    }
});

//p5 fix. remove when p6 comes out
Rally.getApp = function() {
    return Ext.ComponentQuery.query('myapp')[0];
};

//API Bug fix for FF 18+
if (Ext.firefoxVersion >= 18) {
	var noArgs = [];
	Ext.override(Ext.Base, {
		callParent : function(args) {
			var method, superMethod = (method = this.callParent.caller) && (method.$previous || ((method = method.$owner ? method : method.caller) && method.$owner.superclass[method.$name]));
			try {} catch (e) {}
			return superMethod.apply(this, args || noArgs);
		}
	});
}