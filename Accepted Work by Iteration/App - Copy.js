Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [{
    	xtype : 'container',
    	id    : 'viewport'
    }],

    launch: function() {
		App              = this;
		App.teamFilter   = [];
		App.iterData     = {};
		App.teamNameHash = {};
    	//Get the official teams (Projects) from Rally
    	var chartArray = [];
    	var iterNames  = [];
    	App.getTeams(function() {
    		App.getIters(function() {
    			var iterDataArray = [];
    			for (i in App.iterData) { //For each iteration, get the initial scope and final acceptance
    				iterDataArray.push(App.iterData[i]);
    				iterNames.push(App.iterData[i].name);
    			}
				var remaining  = iterDataArray.length;
    			Ext.Array.each(iterDataArray, function(iter) {
    				App.getScopeOn(iter.Start, iter.OIDs, false, function(initialScope) {
    					App.getScopeOn(iter.End, iter.OIDs, true, function(finalScope) {
							var node;
							var nodes = [];
	    					for (i in initialScope) {
	    						node = {
	    							teamName       : initialScope[i].teamName,
	    							initialScope   : initialScope[i].scope,
	    							initialStories : initialScope[i].stories	
	    						};
	    						if (finalScope[i] != undefined) {
									node.finalScope   = finalScope[i].scope;
									node.finalStories = finalScope[i].stories;
	    						} else {
									node.finalScope   = 0;
									node.finalStories = [];
	    						}
	    						nodes.push(node);
	    					}
	    					for (i in finalScope) {
	    						if (initialScope[i] === undefined) {
	    							nodes.push({
	    								teamName       : finalScope[i].teamName,
		    							initialScope   : 0,
		    							initialStories : [],
		    							finalScope     : finalScope[i].scope,
		    							finalStories   : finalScope[i].stories	
		    						});
	    						}
	    					}
	    					chartArray.push({
	    						name  : iter.Name,
	    						teams : nodes
	    					});
	    					if (!--remaining) drawGrid();		
	    				});
	    			});
    			});
    		});
    	});

		function drawGrid() {
			var teamData      = {};
			var teamDataArray = [];
			var fields        = ['teamName'];
			var columns       = [{
					text      : 'Team',
					dataIndex : 'teamName',
					flex      : 1
				}];
			Ext.Array.each(chartArray, function(i) {
				columns.push({
					text      : i.name,
					dataIndex : i.name + '_acceptanceRate',
					flex      : 1,
					align     : 'center',
					renderer  : function(val) {
						return (val != '') ? Ext.util.Format.number(val * 100, '0.0') + '%' : '';
					}
				});
				fields.push(i.name + '_acceptanceRate');
				fields.push(i.name + '_initialScope');
				fields.push(i.name + '_finalScope');
				Ext.Array.each(i.teams, function(t) {
					if (teamData[t.teamName] === undefined)
						teamData[t.teamName] = {
							teamName : t.teamName
						};
					teamData[t.teamName][i.name + '_acceptanceRate'] = (isFinite(t.initialScope) && isFinite(t.finalScope) && t.initialScope > 0) ? parseFloat(t.finalScope / t.initialScope) : null;
					teamData[t.teamName][i.name + '_initialScope']   = (isFinite(t.initialScope)) ? t.initialScope : 0;
					teamData[t.teamName][i.name + '_finalScope']     = (isFinite(t.finalScope)) ? t.finalScope : 0;
					teamData[t.teamName][i.name + '_initialStories'] = t.initialStories;
					teamData[t.teamName][i.name + '_finalStories'] = t.finalStories;
				});
			});
			
			for (t in teamData) {
				teamDataArray.push(teamData[t]);
			}

			console.log(teamDataArray);

			console.log(columns);

			App.down('#viewport').add({
				xtype : 'rallygrid',
				disableSelection: true,
				showPagingToolbar: false,
				store : Ext.create('Rally.data.custom.Store', {
					data     : teamDataArray,
					fields   : fields,
					sorters  : [
						{ property: 'teamName', direction: 'ASC' }
					],
					pageSize : 100000
				}),
				columnCfgs: columns
			});
		}

    },

    getTeams: function(callback) {
    	var loader = Ext.create('Rally.data.WsapiDataStore', {
    		model     : 'Project',
    		fetch     : ['Name','ObjectID'],
    		filters   : [{
    			property : 'Notes',
    			operator : 'contains',
    			value    : '*OFFICIAL AGILE TEAM*'
    		}],
    		listeners : {
    			load : function(store, data) {
    				if (data && data.length) {
    					Ext.Array.each(data, function(i) {
    						App.teamFilter.push({
			    				property : 'Project.ObjectID',
			    				value    : i.raw.ObjectID
			    			});
			    			App.teamNameHash[i.raw.ObjectID] = i.raw.Name;
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

    getIters: function(callback) {
    	var loader = Ext.create('Rally.data.WsapiDataStore', {
    		model     : 'Iteration',
    		fetch     : ['Name','ObjectID','StartDate','EndDate'],
    		filters   : [{
    			property : 'EndDate',
    			operator : '>=',
    			value    : new Date().getFullYear() + '-01-01T00:00:00+00:00'
    		},{
    			property : 'StartDate',
    			operator : '<=',
    			value    : Rally.util.DateTime.toIsoString(new Date())
    		},Rally.data.QueryFilter.or(App.teamFilter)],
    		listeners : {
    			load : function(store, data) {
    				if (data && data.length) {
    					Ext.Array.each(data, function(i) {
    						if (App.iterData[i.raw.Name] === undefined)
    							App.iterData[i.raw.Name] = {
    								Name  : i.raw.Name,
    								Start : Ext.Date.add(Rally.util.DateTime.fromIsoString(i.raw.StartDate), Ext.Date.DAY, 2),
    								End   : Rally.util.DateTime.fromIsoString(i.raw.EndDate),
    								OIDs  : []
    							}
    						App.iterData[i.raw.Name].OIDs.push(i.raw.ObjectID);
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

    getScopeOn: function(date, OIDs, onlyAccepted, callback) {
		var scopeObj = {};
		var filters  = [{
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
			value    : OIDs
		}];
		if (onlyAccepted) filters.push({
			property : 'ScheduleState',
			value    : 'Accepted'
		});
		Ext.create('Rally.data.lookback.SnapshotStore', {
			autoLoad : true,
			pageSize : 1000000,
			fetch    : ['Project','PlanEstimate','ScheduleState'],
			hydrate  : ['ScheduleState'],
			filters  : filters,
			listeners : {
				load : function(store, data, success) {
					Ext.Array.each(data, function(i) {
						if (scopeObj[i.raw.Project] === undefined)
							scopeObj[i.raw.Project] = {
								teamName : App.teamNameHash[i.raw.Project],
								scope   : 0,
								stories : []
							};
						scopeObj[i.raw.Project].scope += parseInt(i.raw.PlanEstimate);
						scopeObj[i.raw.Project].stories.push(i.raw);
					});
					callback(scopeObj);
				}
			}
		});
	}
});