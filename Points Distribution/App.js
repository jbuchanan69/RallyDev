// Points Distribution - Version 1.0
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

	items: [
		{
			xtype: 'container',
			id: 'toolbar'
		},
		{
			xtype: 'container',
			id: 'viewport'
		}
	],

	launch: function() {
		App          = this;
		App.loadMask = new Ext.LoadMask(Ext.getBody());
		var filters  = 6;
		Ext.state.Manager.setProvider(new Ext.state.LocalStorageProvider());
		App.down('#toolbar').add({
			xtype: 'rallymultiobjectpicker',
			id: 'teams',
			cls: 'filter',
			modelType: 'Project',
			width: 200,
			fieldLabel: 'Teams',
			labelWidth: 38,
			stateful: true,
			stateId: 'pdTeams',
			stateEvents: [ 'collapse' ],
			getState: function() { return { value: this.getValue() }; },
			applyState: function(state) { this.setValue(state.value); },
			listeners: {
				blur: function() { App.down('#teams').collapse(); },
				added: onFilterReady
			}
		});
		App.down('#toolbar').add({
			xtype: 'rallymultiobjectpicker',
			id: 'tags',
			cls: 'filter',
			modelType: 'Tag',
			width: 200,
			fieldLabel: 'Tags',
			labelWidth: 30,
			stateful: true,
			stateId: 'pdTags',
			stateEvents: [ 'collapse' ],
			getState: function() { return { value: this.getValue() }; },
			applyState: function(state) { this.setValue(state.value); },
			listeners: {
				blur: function() { App.down('#tags').collapse(); },
				added: onFilterReady
			}
		});
		App.down('#toolbar').add({
			xtype: 'rallyiterationcombobox',
			id: 'minIter',
			cls: 'filter',
			width: 200,
			fieldLabel: 'Min Iteration:',
			labelWidth: 65,
			stateful: true,
			stateId: 'pdMinIter',
			stateEvents: [ 'change' ],
			getState: function() { return { value: this.getValue() }; },
			applyState: function(state) { this.setValue(state.value); },
			listeners: {
				ready: onFilterReady
			}
		});
		App.down('#toolbar').add({
			xtype: 'rallyiterationcombobox',
			id: 'maxIter',
			cls: 'filter',
			width: 200,
			fieldLabel: 'Max Iteration:',
			labelWidth: 65,
			stateful: true,
			stateId: 'pdMaxIter',
			stateEvents: [ 'change' ],
			getState: function() { return { value: this.getValue() }; },
			applyState: function(state) { this.setValue(state.value); },
			listeners: {
				ready: onFilterReady
			}
		});
		App.down('#toolbar').add({
			xtype: 'radiogroup',
			id: 'grouping',
			cls: 'filter',
	        fieldLabel: 'Grouping',
	        labelWidth: 40,
	        stateful: true,
			stateId: 'pdGrouping',
			stateEvents: [ 'change' ],
			getState: function() { return { value: this.getValue() }; },
			applyState: function(state) { this.setValue(state.value); },
	        items: [
	            { boxLabel: 'Tag',  name: 'method', inputValue: 'tag',  width: 40, checked: true },
	            { boxLabel: 'Team', name: 'method', inputValue: 'team', width: 45                }
	        ],
	        listeners: {
				added: onFilterReady
			}
		});
		App.down('#toolbar').add({
			xtype: 'checkboxgroup',
			id: 'states',
			cls: 'filter',
			fieldLabel: 'State',
			labelWidth: 20,
			labelAlign: 'left',
			stateful: true,
			stateId: 'pdStates',
			stateEvents: [ 'change' ],
			getState: function() { return { value: this.getValue() }; },
			applyState: function(state) { this.setValue(state.value); },
			items: [
				{ boxLabel: 'I', name: 'states', inputValue: 'Initial Version', width: 30, checked: true },
	            { boxLabel: 'D', name: 'states', inputValue: 'Defined',         width: 30, checked: true },
	            { boxLabel: 'P', name: 'states', inputValue: 'In-Progress',     width: 30, checked: true },
	            { boxLabel: 'C', name: 'states', inputValue: 'Completed',       width: 30, checked: true },
	            { boxLabel: 'A', name: 'states', inputValue: 'Accepted',        width: 30, checked: true }
			],
			listeners: {
				added: onFilterReady
			}
		});
		App.down('#toolbar').add({
			xtype: 'button',
			text: 'Update Graph',
			width: 100,
			handler: App.getPoints
		});
		
		function onFilterReady() {
			if (--filters == 0) App.getPoints();
		}
	},

	getPoints: function() {
		//Filter error check
		var filter = [];
		if (App.down('#states').getValue().states == undefined || App.down('#states').getValue().states.length == 0) {
			Ext.Msg.alert('Error', 'No User Story states have been selected.');
			return;
		}

		App.iterations = [];
		App.points     = {};
		App.loadMask.show();

		//Create tag list if needed
		if (App.down('#grouping').getValue().method == 'tag') {
			var selectedTags = [];
			Ext.Array.each(App.down('#tags').getValue(), function(tag) {
				selectedTags.push(tag._refObjectName);
			});
		}

		//Compose Filter
		var stateFilter = undefined;
		Ext.Array.each(App.down('#states').getValue().states, function(state) {
			if (stateFilter) {
				stateFilter = stateFilter.or(Ext.create('Rally.data.QueryFilter',
					{ property: 'ScheduleState', value: state }
				));
			} else {
				stateFilter = Ext.create('Rally.data.QueryFilter',
					{ property: 'ScheduleState', value: state }
				);
			}
		});
		filter.push(stateFilter);
		if (App.down('#tags').getValue() && App.down('#tags').getValue().length) {
			var tagFilter = undefined;
			Ext.Array.each(App.down('#tags').getValue(), function(tag) {
				if (tagFilter) {
					tagFilter = tagFilter.or(Ext.create('Rally.data.QueryFilter',
						{ property: 'Tags.Name', operator: 'contains', value: tag.Name }
					));
				} else {
					tagFilter = Ext.create('Rally.data.QueryFilter',
						{ property: 'Tags.Name', operator: 'contains', value: tag.Name }
					);
				}
			});
			filter.push(tagFilter);
		}
		if (App.down('#teams').getValue() && App.down('#teams').getValue().length) {
			var teamFilter = undefined;
			Ext.Array.each(App.down('#teams').getValue(), function(team) {
				if (teamFilter) {
					teamFilter = teamFilter.or(Ext.create('Rally.data.QueryFilter',
						{ property: 'Project.Name', operator: '=', value: team.Name }
					));
				} else {
					teamFilter = Ext.create('Rally.data.QueryFilter',
						{ property: 'Project.Name', operator: '=', value: team.Name }
					);
				}
			});
			filter.push(teamFilter);
		}

		filter.push({ property: 'Iteration.StartDate', operator: '>=', value: App.down('#minIter').getRecord().get('StartDate').toISOString() });
		filter.push({ property: 'Iteration.StartDate', operator: '<=', value: App.down('#maxIter').getRecord().get('StartDate').toISOString() });
		filter.push({ property: 'PlanEstimate',        operator: '>',  value: 0                                                               });

		var loader = Ext.create('Rally.data.WsapiDataStore', {
			autoLoad: true,
			model: 'UserStory',
			fetch: [ 'Iteration', 'PlanEstimate', 'Project', 'ScheduleState', 'Tags' ],
			filters: filter,
			listeners: {
				load: function(store, data) {
					if (data && data.length) {
						Ext.Array.each(data, function(US) {
							if (Ext.Array.indexOf(App.iterations, US.get('Iteration')._refObjectName) == -1) { //New iteration
								App.newIters = true;
								App.iterations.push(US.get('Iteration')._refObjectName);
							}
							if (App.down('#grouping').getValue().method == 'team') { //Team grouping
								if (App.points[US.get('Project')._refObjectName] == undefined) {
									App.points[US.get('Project')._refObjectName] = {};
								}
								if (App.points[US.get('Project')._refObjectName][US.get('Iteration')._refObjectName] == undefined) {
									App.points[US.get('Project')._refObjectName][US.get('Iteration')._refObjectName] = 0;
								}
								App.points[US.get('Project')._refObjectName][US.get('Iteration')._refObjectName] += US.get('PlanEstimate');
							} else { //Tag grouping
								Ext.Array.each(US.get('Tags'), function(tag) {
									if (selectedTags.length == 0 || Ext.Array.indexOf(selectedTags, tag._refObjectName) != -1) {
										if (App.points[tag._refObjectName] == undefined) {
											App.points[tag._refObjectName] = {};
										}
										if (App.points[tag._refObjectName][US.get('Iteration')._refObjectName] == undefined) {
											App.points[tag._refObjectName][US.get('Iteration')._refObjectName] = 0;
										}
										App.points[tag._refObjectName][US.get('Iteration')._refObjectName] += US.get('PlanEstimate');
									}
								});
							}
						});
						loader.nextPage();
					} else {
						App.drawGraph();
					}
				},
				scope: this
			}
		});
	},

	drawGraph: function() {
		App.iterations.sort();
		var nodes = [];
		Ext.Array.each(App.iterations, function(iter, key) {
			var node = {
				name: iter.substring(0,14)
			};
			for (idx in App.points) {
				if (App.points[idx][iter] != undefined) {
					node[idx] = App.points[idx][iter];
				} else {
					node[idx] = 0;
				}
			}
			nodes.push(node);
		});

		App.loadMask.hide();

		var fields = [];
		for (idx in App.points) {
			fields.push(idx);
		}

		Ext.onReady(function() {
			var store = new Ext.data.Store({
				autoLoad: true,
				fields: fields.concat('name'),
				proxy: {
					type: 'memory',
					reader: {
						type: 'json',
						root: 'data'
					}
				},
				data: []
			});

			store.loadData(nodes, false);

			var chart = {
				xtype: 'container',
				margins: '0 5',
				width: Ext.get('viewport').getWidth(),
				height: Ext.getBody().getHeight() - 35,
				layout: {
					type: 'hbox',
					align: 'stretch',
				},
				items: [
                    {
                    	xtype: 'chart',
                    	legend: {
                    		position: 'right'
                    	},
                    	flex: 1,
                    	animate: true,
                    	shadow: true,
                    	store: store,
                    	axes: [
                    		{
	                    		type: 'Numeric',
	                    		position: 'left',
	                    		fields: fields,
	                    		title: false,
	                    		grid: true
	                    	}, {
	                    		type: 'Category',
	                    		position: 'bottom',
	                    		fields: ['name'],
	                    		title: ''
	                    	}
                        ],
                    	series: [
                        	{
	                        	type: 'column',
	                        	axis: 'left',
	                        	gutter: 80,
	                        	xField: 'name',
	                        	yField: fields,
	                        	stacked: true,
	                        	tips: {
								    trackMouse: true,
								    width: 250,
								    height: 35,
								    renderer: function(storeItem, item) {
								        var colorIndex  = Ext.Array.indexOf(item.series.colorArrayStyle, item.attr.fill);
										var colorsCount = item.series.colorArrayStyle.length;
										var cycle = -1, barTitle;
										do {
											cycle++;
											barTitle = item.series.yField[colorIndex + cycle * colorsCount];
										} while (barTitle && item.value[1] != storeItem.get(barTitle));
										this.update(storeItem.get('name') + '<br /><b>' + barTitle + ': ' + item.value[1] + ' Points</b>');
									}
								}
							}
                        ],
                    }
                ]
			};

			App.down('#viewport').removeAll();
			App.down('#viewport').add({
				items: [ chart ],
				border: 0
			});
		});

	}
});