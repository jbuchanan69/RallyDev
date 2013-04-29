// Accepted Work by Iteration Report - Version 0.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [{
    	xtype : 'container',
    	id    : 'viewport'
    }],

    launch: function() {
		App = this;
		App.chartObj = {};
		App.iterData = {};
		App.iterHash = {};
		Ext.getBody().mask('Loading');
		App.getIters(function() {	
			var remaining = 0;
			for (i in App.iterData) {
				remaining++;
				App.getIterScope(App.iterData[i], function() {
					if (!--remaining) App.drawChart();
				});
			}
		});
    },

    getIters: function(callback) {
    	var loader = Ext.create('Rally.data.WsapiDataStore', {
			model     : 'Iteration',
			fetch     : ['EndDate','Name','ObjectID','Project','StartDate'],
			filters   : [{
				property : 'Project.Notes',
				operator : 'contains',
				value    : '*OFFICIAL AGILE TEAM*'
			},{
    			property : 'EndDate',
    			operator : '>=',
    			value    : new Date().getFullYear() + '-01-01T00:00:00+00:00'
    		},{
    			property : 'StartDate',
    			operator : '<=',
    			value    : Rally.util.DateTime.toIsoString(new Date())
    		}],
			listeners : {
				load : function(store, data) {
					if (data && data.length) {
						Ext.Array.each(data, function(i) {
							if (App.chartObj[i.raw.Project.ObjectID] === undefined) {
								App.chartObj[i.raw.Project.ObjectID] = {
									teamName : i.raw.Project.Name
								};
							}
							App.chartObj[i.raw.Project.ObjectID][i.raw.Name + '___initialScope']   = 0;
							App.chartObj[i.raw.Project.ObjectID][i.raw.Name + '___initialStories'] = [];
							App.chartObj[i.raw.Project.ObjectID][i.raw.Name + '___finalScope']     = 0;
							App.chartObj[i.raw.Project.ObjectID][i.raw.Name + '___finalStories']   = [];
							if (App.iterData[i.raw.Name] === undefined) {
								App.iterData[i.raw.Name] = {
									OIDs  : [],
									Start : Ext.Date.add(Rally.util.DateTime.fromIsoString(i.raw.StartDate), Ext.Date.DAY, 2),
									End   : Rally.util.DateTime.fromIsoString(i.raw.EndDate)
								};
							}
							App.iterData[i.raw.Name].OIDs.push(i.raw.ObjectID);
							App.iterHash[i.raw.ObjectID] = i.raw.Name;
						});
						loader.nextPage();
					} else {
						callback();
					}
				}
			}
		});
		loader.loadPage(1);
    },

    getIterScope: function(iterObj, callback) {
    	getScopeOn(iterObj.Start, true, function() {
    		getScopeOn(iterObj.End, false, callback);
    	});

    	function getScopeOn(date, initial, callback2) {
    		var filters = [{
				property : '__At',
				value    : Rally.util.DateTime.toIsoString(date)
			},{
				property : '_TypeHierarchy',
				value    : 'HierarchicalRequirement'
			},{
				property : 'Children',
				value    : null
			},{
				property : 'Iteration',
				operator : 'in',
				value    : iterObj.OIDs
			}];
    		if (!initial) filters.push({
    			property : 'ScheduleState',
    			value    : 'Accepted'
    		});
    		Ext.create('Rally.data.lookback.SnapshotStore', {
				autoLoad  : true,
				pageSize  : 1000000,
				fetch     : ['Iteration','Name','PlanEstimate','Project'],
				filters   : filters,
				listeners : {
    				load : function(store, data, success) {
    					Ext.Array.each(data, function(i) {
    						if (initial) {
								if (isFinite(i.raw.PlanEstimate)) App.chartObj[i.raw.Project][App.iterHash[i.raw.Iteration] + '___initialScope'] += i.raw.PlanEstimate;
								App.chartObj[i.raw.Project][App.iterHash[i.raw.Iteration] + '___initialStories'].push(i.raw);
    						} else {
    							if (isFinite(i.raw.PlanEstimate)) App.chartObj[i.raw.Project][App.iterHash[i.raw.Iteration] + '___finalScope'] += i.raw.PlanEstimate;
								App.chartObj[i.raw.Project][App.iterHash[i.raw.Iteration] + '___finalStories'].push(i.raw);
    						}
    					});
    					callback2();
    				}
    			}
    		});
    	}
    },

    drawChart: function() {
    	Ext.getBody().unmask();
    	var chartArray = [];
    	for (i in App.chartObj) {
    		for (j in App.iterData) {
    			App.chartObj[i][j + '___acceptanceRate'] = App.chartObj[i][j + '___finalScope'] / App.chartObj[i][j + '___initialScope']
    		}
    		chartArray.push(App.chartObj[i]);
    	}
    	var columns = [{
			text      : 'Team',
			dataIndex : 'teamName',
			flex      : 1
    	}];
    	var fields = ['teamName'];
    	for (i in App.iterData) {
    		columns.push({
				text      : i,
				dataIndex : i + '___acceptanceRate',
				width     : 180,
				align     : 'center',
				renderer  : function(val, meta, record, row, col) {
					if (isFinite(val)) {
						(val >= .9 && val <= 1.2) ? meta.tdCls = 'green' : ((val >= .5 && val < .9) || (val > 1.2 && val <= 1.5)) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
						return '<div class="half">' + Ext.util.Format.number(val * 100, '0.0') + '%</div><div class="half">' + record.get(columns[col].text + '___finalScope') + ' of ' + record.get(columns[col].text + '___initialScope') + '</div>';
					} else {
						return '';
					}
				}
    		});
    		fields.push(i + '___acceptanceRate');
    		fields.push(i + '___initialScope');
    		fields.push(i + '___initialStories');
    		fields.push(i + '___finalScope');
    		fields.push(i + '___finalStories');
    	}
    	App.down('#viewport').add({
			xtype : 'rallygrid',
			disableSelection: true,
			showPagingToolbar: false,
			store : Ext.create('Rally.data.custom.Store', {
				data     : chartArray,
				fields   : fields,
				sorters  : [
					{ property: 'teamName', direction: 'ASC' }
				],
				pageSize : 1000
			}),
			columnCfgs: columns
		});
    }
});