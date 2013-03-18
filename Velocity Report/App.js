Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

	items: [
		{
			xtype : 'panel',
			id: 'iterPanel',
			cls: 'pan',
			title : 'Iteration Range:',
			width : 425
		} , {
			xtype : 'panel',
			id: 'filterPanel',
			cls: 'pan',
			title : 'Filters:',
			width : 239
		} , {
			xtype: 'container',
			id: 'graph'
		} , {
			xtype: 'container',
			id: 'table'
		}
	],		

	launch: function() {
		mask = new Ext.LoadMask(Ext.getBody());
		this.down('#iterPanel').add({
			xtype: 'datefield',
			id: 'minDate',
			cls: 'filter',
			fieldLabel: 'From',
			labelWidth: 40,
			showToday: false,
			maxValue: new Date(),
			value: new Date(new Date().getFullYear(), 0, 1),
			listeners: {
				change: this.doQuery,
				scope: this
			}
		});

		this.down('#iterPanel').add({
			xtype: 'datefield',
			id: 'maxDate',
			cls: 'filter',
			fieldLabel: 'To',
			labelAlign: 'right',
			labelWidth: 40,
			showToday: false,
			value: new Date(),
			listeners: {
				change: this.doQuery,
				scope: this
			}
		});

		Ext.state.Manager.setProvider(new Ext.state.CookieProvider());
		this.down('#filterPanel').add({
			xtype: 'rallymultiobjectpicker',
			id: 'teams',
			cls: 'filter',
			modelType: 'project',
			fieldLabel: 'Teams',
			labelWidth: 40,
			width: 210,
			stateful: true,
			stateId: 'tpSelected',
			stateEvents: [ 'collapse' ],
			getState: function() {
				return { value: this.getValue() };
			},
			applyState: function(state) {
				this.setValue(state.value);
			},
			listeners: {
				blur: function() { this.down('#teams').collapse(); },
				collapse: this.doQuery,
				added: this.doQuery,
				scope: this
			}
		});
	},

	doQuery: function() {
		if (this.down('#teams').getValue() && this.down('#teams').getValue().length) {
			mask.show();
			var iterations = [];
			var tableData  = {};
			//Create team filter
			var filters = undefined;
			Ext.Array.each(this.down('#teams').getValue(), function(team) {
				if (filters) {
					filters = filters.or(Ext.create('Rally.data.QueryFilter', {
						property: 'Project.Name',
						operator: '=',
						value: team.Name
					}));
				} else {
					filters = Ext.create('Rally.data.QueryFilter', {
						property: 'Project.Name',
						operator: '=',
						value: team.Name
					});
				}
			});
			filters = [ filters ];
			filters.push({ property: 'PlanEstimate',        operator: '>', value: 0                                                                 });
			filters.push({ property: 'ScheduleState',       operator: '=', value: 'Accepted'                                                        });
			filters.push({ property: 'Iteration.StartDate', operator: '>', value: Rally.util.DateTime.toIsoString(this.down('#minDate').getValue()) });
			filters.push({ property: 'Iteration.StartDate', operator: '<', value: Rally.util.DateTime.toIsoString(this.down('#maxDate').getValue()) });
			
			//Load the query results
			var loader = Ext.create('Rally.data.WsapiDataStore', {
				autoLoad: true,
				fetch: [ 'PlanEstimate', 'Iteration', 'StartDate', 'Project' ],
				filters: filters,
				sorters: [
					{ property: 'Project',   direction: 'ASC' },
					{ property: 'Iteration', direction: 'ASC' }
				],
				model: 'UserStory',
				listeners: {
					load: function(store, data) {
						if (data && data.length) {
							Ext.Array.each(data, function(US) {
								var teamName = US.get('Project')._refObjectName;
								var iterName = US.get('Iteration')._refObjectName.match(/\d{4} Sprint \d{1,2}/);
								if (iterName) iterName = iterName[0].replace(/Sprint 0/,'Sprint ');
								if (iterName && Ext.Array.indexOf(iterations, iterName) == -1) {
									iterations.push(iterName);
								}
								//Create team node if it doesn't exist
								if (!tableData[teamName])
									 tableData[teamName] = {};
								//Create iteration node if it doesn't exist
								if (!tableData[teamName][iterName])
									 tableData[teamName][iterName] = 0;
								//Add points to existing node
								tableData[teamName][iterName] += US.get('PlanEstimate');
							});
							loader.nextPage();
						} else {
							//All data loaded, convert to native graph data
							iterations.sort(function(a, b) {
								aMatch = a.match(/(\d{4}) Sprint (\d{1,2})/);
								bMatch = b.match(/(\d{4}) Sprint (\d{1,2})/);
								if (!aMatch || !bMatch) return 0;   //Error parsing iter names
								if (aMatch[1] == bMatch[1]) {       //Same year, sort by iteration number
									return aMatch[2] - bMatch[2];
								} else {                            //Sort by year
									return aMatch[1] - bMatch[1];
								}
							});
							var series = [];
							for (team in tableData) {
								var line = [];
								for (iter in iterations) {
									if (tableData[team][iterations[iter]])
										line.push(tableData[team][iterations[iter]]);
									else
										line.push(0);
								}
								series.push({
									name: team,
									data: line
								});
							}
							//Done pulling data, display it
							mask.hide();
							if (iterations && iterations.length) {
								this.render(iterations, series);
							} else {
								Ext.Msg.alert('Error', 'No data matching the selected criteria.');
							}
						}
					},
					scope: this
				}
			});
		} else {
			this.down('#table').removeAll();
		}
	},

	render: function(iterations, series) {
		var graphData = [];
		Ext.Array.each(iterations, function(iter, key) {
			var node = {
				name: iter
			};
			Ext.Array.each(series, function(team) {
				node[team.name] = team.data[key];
			});
			graphData.push(node);
		});
		var teams = [];
		var lines = [];
		var lineMarkers = ['circle', 'cross'];
		Ext.Array.each(series, function(team) {
			teams.push(team.name);
			lines.push({
				type: 'line',
				highlight: {
				    size: 7,
				    radius: 7
				},
				axis: 'left',
				xField: 'name',
				yField: team.name,
				markerConfig: {
				    type: lineMarkers[Math.floor(Math.random() * lineMarkers.length)],
				    size: 4,
				    radius: 4,
				    'stroke-width': 0
				}
			});
		});
		var store = Ext.create('Ext.data.JsonStore', {
		    fields: ['name'].concat(teams),
		    data: graphData
		});
		var graph = Ext.create('Ext.chart.Chart', {
		    width: Ext.get('graph').getWidth(),
		    height: 300,
		    animate: true,
		    store: store,
		    legend: {
        		position: 'top'
        	},
		    axes: [
		        {
		            type: 'Numeric',
		            position: 'left',
		            fields: teams,
		            label: {
		                renderer: Ext.util.Format.numberRenderer('0,0')
		            },
		            title: 'Velocity',
		            grid: true,
		            minimum: 0
		        },
		        {
		            type: 'Category',
		            position: 'bottom',
		            fields: ['name'],
		            title: ''
		        }
		    ],
		    series: lines
		});
		this.down('#graph').removeAll();
		this.down('#graph').add({
			items: [ graph ],
			border: 0
		});

		//Create the table
		var records = [];
		Ext.Array.each(series, function(s) {
			var record = {};
			record.Team = s.name;
			Ext.Array.each(iterations, function(iter, key) {
				record[iter] = s.data[key];
			});
			records.push(record);
		});
		var columns = [{
			text: 'Team',
			dataIndex: 'Team',
			width: 150
		}];
		Ext.Array.each(iterations, function(iter) {
			columns.push({
				text: iter,
				dataIndex: iter,
				flex: 1
			});
		});
		this.down('#table').removeAll();
		this.down('#table').add({
			xtype: 'rallygrid',
			store: Ext.create('Rally.data.custom.Store', {
				data: records,
				pageSize: 10
			}),
			columnCfgs: columns
		});
	}
});