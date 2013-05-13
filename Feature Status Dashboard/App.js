// Feature Status Dash - Version 0.1.1
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
        split       : true
    },
    items: [{
        title   : 'Settings',
        id      : 'popout',
        region  : 'west',
        margins : '5 0 0 0',
        width   : 270,
        tools   : [{
            type    :'save',
            handler : function(event, toolEl, panel){
                Ext.onReady(function() {
                    if (/*@cc_on!@*/0) { //Exporting to Excel not supported in IE
                        Ext.Msg.alert('Error', 'Exporting to CSV is not supported in Internet Explorer. Please switch to a different browser and try again.');
                    } else if (App.down('#viewport_grid')) {
                        Ext.getBody().mask('Exporting Chart...');
                        setTimeout(function() {
                            var template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';
                            var base64   = function(s) { return window.btoa(unescape(encodeURIComponent(s))) };
                            var format   = function(s, c) { return s.replace(/{(\w+)}/g, function(m, p) { return c[p]; }) };
                            var table    = document.getElementById('viewport_grid');

                            var excel_data = '<tr>';
                            Ext.Array.each(table.innerHTML.match(/<span .*?x-column-header-text.*?>.*?<\/span>/gm), function(column_header_span) {
                                excel_data += (column_header_span.replace(/span/g,'td'));
                            });
                            excel_data += '</tr>';
                            Ext.Array.each(table.innerHTML.match(/<tr class="x-grid-row.*?<\/tr>/gm), function(line) {
                                excel_data += line.replace(/[^\011\012\015\040-\177]/g, '>>');
                            });

                            var ctx = {worksheet: name || 'Worksheet', table: excel_data};
                            window.location.href = 'data:application/vnd.ms-excel;base64,' + base64(format(template, ctx));
                            Ext.getBody().unmask();
                        }, 500);
                    }
                });
            }
        }],
        layout: {
            type  : 'vbox',
            align : 'stretch'
        },
        items: [{
            id     : 'rpmTreeContainer', 
            layout : 'fit',
            border : 0,
            flex   : 1
        }]
    },{
        id          : 'viewport',
        collapsible : false,
        region      : 'center',
        margins     : '5 0 0 0'
    }],

    launch: function() {
        App = this;
        App.teamNameHash  = {};
        App.ownerNameHash = {};
        App.down('#viewport').addListener('resize', function() {
            if (App.popup) {
                App.popup.setWidth(Ext.getBody().getWidth());
                App.popup.setHeight(Ext.getBody().getHeight());
            }
        });
        App.rpmTree.init();
        var projectLoader = Ext.create('Rally.data.WsapiDataStore', {
        	model     : 'Project',
        	fetch     : ['ObjectID','Name'],
        	listeners : {
        		load : function(store, data) {
        			if (data && data.length) {
        				Ext.Array.each(data, function(i) {
        					App.teamNameHash[i.raw.ObjectID] = i.raw.Name;
        				});
        				projectLoader.nextPage();
        			}
        		}
        	}
        });
        projectLoader.loadPage(1);
        var ownerLoader = Ext.create('Rally.data.WsapiDataStore', {
        	model     : 'User',
        	fetch     : ['ObjectID','FirstName','LastName'],
        	listeners : {
        		load : function(store, data) {
        			if (data && data.length) {
        				Ext.Array.each(data, function(i) {
        					App.ownerNameHash[i.raw.ObjectID] = i.raw.FirstName + ' ' + i.raw.LastName;
        				});
        				ownerLoader.nextPage();
        			}
        		}
        	}
        });
        ownerLoader.loadPage(1);
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
                    'ObjectID'
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
                                    name   : i.raw.Name,
                                    text   : '<span class="count">' + i.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + i.raw.Name + '</span>',
                                    id     : i.raw.ObjectID,
                                    leaf   : i.raw.Children == undefined || i.raw.Children.length == 0
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
                                                name   : c.raw.Name,
                                                text   : '<span class="count">' + c.raw.LeafStoryCount + '</span> - <span class="nodeTitle">' + c.raw.Name + '</span>',
                                                id     : c.raw.ObjectID,
                                                leaf   : c.raw.Children == undefined || c.raw.Children.length == 0
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
                                    fetch: [
                                        'Children',
                                        'LeafStoryCount',
                                        'Name',
                                        'ObjectID'
                                    ],
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
        }
    },

    viewport: {
        update: function() {
            Ext.getBody().mask('Loading');
        	var detailObj = {};
        	//Get the feature nodes from under the selected RPM level
        	Ext.create('Rally.data.lookback.SnapshotStore', {
        		autoLoad : true,
        		pageSize : 1000000,
        		fetch    : [
        			'ObjectID',
        			'_UnformattedID',
        			'Name',
        			'PlannedStartDate',
        			'ActualStartDate',
        			'PlannedEndDate',
        			'ActualEndDate',
                    'Owner',
                    'c_GoLiveDate',
                    'c_BusinessProcessOwner',
                    'c_BusinessExecutive',
                    'c_ProjectManager',
                    'c_ContingencyDate'
        		],
        		filters  : [{
        			property : '__At',
        			value    : 'current'
        		},{
        			property : '_TypeHierarchy',
        			value    : 'PortfolioItem/Feature'
        		},{
        			property : '_ItemHierarchy',
        			operator : 'in',
        			value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
        		}],
        		listeners : {
        			load : function(store, data, success) {
        				var remaining = 0;
        				Ext.Array.each(data, function(i) {
        					i.raw.TeamStats = {};
        					detailObj[i.raw.ObjectID] = i.raw;
        					//For each Feature found, query for all user stories parented to that level
        					remaining++;
        					getFeatureDetails(i.raw.ObjectID, function() {
        						if (!--remaining) onAllDetails();
        					});
        				});
        			}
        		}
        	});

        	function getFeatureDetails(OID, callback) {
        		Ext.create('Rally.data.lookback.SnapshotStore', {
        			autoLoad : true,
        			pageSize : 1000000,
        			fetch    : [
        				'Owner',
        				'ScheduleState',
        				'PlanEstimate',
        				'Project',
        				'Blocked',
        				'Iteration'
        			],
        			hydrate  : [
        				'ScheduleState'
        			],
        			filters  : [{
        				property : '__At',
        				value    : 'current'
        			},{
        				property : '_TypeHierarchy',
        				value    : 'HierarchicalRequirement'
        			},{
        				property : '_ItemHierarchy',
        				operator : 'in',
        				value    : OID
        			}],
        			listeners : {
        				load : function(store, data, success) {
        					Ext.Array.each(data, function(i) {
        						if (detailObj[OID].TeamStats[i.raw.Project] === undefined)
        							detailObj[OID].TeamStats[i.raw.Project] = {
        								TeamName         : App.teamNameHash[i.raw.Project],
										TotalStories     : 0,
										EstimatedStories : 0,
										ScheduledStories : 0,
										NonIVStories     : 0,
										BlockedStories   : 0,
										AcceptedStories  : 0
        							}
        						//Using this User Story, update the stats for this team
        						detailObj[OID].TeamStats[i.raw.Project].TotalStories++;
        						if (i.raw.PlanEstimate)                       detailObj[OID].TeamStats[i.raw.Project].EstimatedStories++;
        						if (i.raw.Iteration)                          detailObj[OID].TeamStats[i.raw.Project].ScheduledStories++;
        						if (i.raw.ScheduleState != 'Initial Version') detailObj[OID].TeamStats[i.raw.Project].NonIVStories++;
        						if (i.raw.Blocked)                            detailObj[OID].TeamStats[i.raw.Project].BlockedStories++;
        						if (i.raw.ScheduleState == 'Accepted')        detailObj[OID].TeamStats[i.raw.Project].AcceptedStories++;
        					});
        					callback();
        				}
        			}
        		});
        	}

        	function onAllDetails() {
        		gridArray = []; 
        		for (d in detailObj) {
        			for (t in detailObj[d].TeamStats) {
                        detailObj[d].TeamStats[t].EstimatedStoriesRate   = parseFloat(detailObj[d].TeamStats[t].EstimatedStories / detailObj[d].TeamStats[t].TotalStories) || 0.0;
                        detailObj[d].TeamStats[t].ScheduledStoriesRate   = parseFloat(detailObj[d].TeamStats[t].ScheduledStories / detailObj[d].TeamStats[t].TotalStories) || 0.0;
                        detailObj[d].TeamStats[t].NonIVStoriesRate       = parseFloat(detailObj[d].TeamStats[t].NonIVStories     / detailObj[d].TeamStats[t].TotalStories) || 0.0;
                        detailObj[d].TeamStats[t].AcceptedStoriesRate    = parseFloat(detailObj[d].TeamStats[t].AcceptedStories  / detailObj[d].TeamStats[t].TotalStories) || 0.0;
                        detailObj[d].TeamStats[t].FeatureID              = 'F' + detailObj[d]._UnformattedID;
                        detailObj[d].TeamStats[t].FeatureName            = detailObj[d].Name;
                        detailObj[d].TeamStats[t].FeatureOID             = detailObj[d].ObjectID;
                        detailObj[d].TeamStats[t].FeatureOwnerName       = App.ownerNameHash[detailObj[d].Owner];
                        detailObj[d].TeamStats[t].FeaturePlannedStart    = detailObj[d].PlannedStartDate;
                        detailObj[d].TeamStats[t].FeatureActualStart     = detailObj[d].ActualStartDate;
                        detailObj[d].TeamStats[t].FeaturePlannedEnd      = detailObj[d].PlannedEndDate;
                        detailObj[d].TeamStats[t].FeatureActualEnd       = detailObj[d].ActualEndDate;
                        detailObj[d].TeamStats[t].FeatureGoLiveDate      = detailObj[d].c_GoLiveDate;
                        detailObj[d].TeamStats[t].FeatureBPO             = detailObj[d].c_BusinessProcessOwner;
                        detailObj[d].TeamStats[t].FeatureBE              = detailObj[d].c_BusinessExecutive;
                        detailObj[d].TeamStats[t].FeaturePM              = detailObj[d].c_ProjectManager;
                        detailObj[d].TeamStats[t].FeatureContingencyDate = detailObj[d].c_ContingencyDate;

                        detailObj[d].TeamStats[t].Color = (
                            detailObj[d].TeamStats[t].EstimatedStoriesRate >= .9 &&
                            detailObj[d].TeamStats[t].ScheduledStoriesRate >= .9 &&
                            detailObj[d].TeamStats[t].NonIVStories         >= .9 &&
                            detailObj[d].TeamStats[t].AcceptedStoriesRate  >= .9
                        ) ? 0 : (
                            detailObj[d].TeamStats[t].EstimatedStoriesRate >= .5 &&
                            detailObj[d].TeamStats[t].ScheduledStoriesRate >= .5 &&
                            detailObj[d].TeamStats[t].NonIVStories         >= .5 &&
                            detailObj[d].TeamStats[t].AcceptedStoriesRate  >= .5
                        ) ? 1 : 2;

                        detailObj[d].TeamStats[t].FeatureActualEnd = gridArray.push(detailObj[d].TeamStats[t]);
        			}
        		}
                Ext.getBody().unmask();
        		App.down('#viewport').removeAll();
				App.down('#viewport').add({
					xtype             : 'rallygrid',
					id                : 'viewport_grid',
					disableSelection  : true,
					showPagingToolbar : false,
					store             : Ext.create('Rally.data.custom.Store', {
						data     : gridArray,
						pageSize : 1000000,
						sorters  : [{
							property  : 'FeatureName',
							direction : 'ASC'
						}]
					}),
					columnCfgs : [{
                        dataIndex : 'Color',
                        width     : 29,
                        renderer  : function(val, meta, record) {
                            meta.tdCls = ['green','yellow','red'][val];
                            return '';
                        }
                    },{
						text      : 'ID',
						dataIndex : 'FeatureID',
						width     : 60,
                        resizable : false,
					},{
						text      : 'Feature',
						dataIndex : 'FeatureName',
						flex      : 1,
						minWidth  : 120
					},{
                        text      : 'Product Owner',
                        dataIndex : 'FeatureOwnerName',
                        width     : 80,
                        resizable : false,
                        align     : 'center'
                    },{
                        text      : 'Planned Start Date',
                        dataIndex : 'FeaturePlannedStart',
                        width     : 80,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val) {
                            return (val && typeof val == 'string') ? val.substring(0,10) : '';
                        }
                    },{
                        text      : 'Planned End Date',
                        dataIndex : 'FeaturePlannedEnd',
                        width     : 80,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val) {
                            return (val && typeof val == 'string') ? val.substring(0,10) : '';
                        }
                    },{
                        text      : 'Actual Start Date',
                        dataIndex : 'FeatureActualStart',
                        width     : 80,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val) {
                            return (val && typeof val == 'string') ? val.substring(0,10) : '';
                        }
                    },{
                        text      : 'Actual End Date',
                        dataIndex : 'FeatureActualEnd',
                        width     : 80,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val) {
                            return (val && typeof val == 'string') ? val.substring(0,10) : '';
                        }
                    },{
                        text      : 'Go Live Date',
                        dataIndex : 'FeatureGoLiveDate',
                        width     : 80,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val) {
                            return (val && typeof val == 'string') ? val.substring(0,10) : '';
                        }
                    },{
                        text      : 'Contingency Date',
                        dataIndex : 'FeatureContingencyDate',
                        width     : 80,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val) {
                            return (val && typeof val == 'string') ? val.substring(0,10) : '';
                        }
                    },{
						text      : 'Team',
						dataIndex : 'TeamName',
						flex      : 1,
						minWidth  : 120
					},{
                        text      : 'Business Process Owner',
                        dataIndex : 'FeatureBPO',
                        width     : 80,
                        resizable : false,
                        align     : 'center'
                    },{
                        text      : 'Business Executive',
                        dataIndex : 'FeatureBE',
                        width     : 80,
                        resizable : false,
                        align     : 'center'
                    },{
                        text      : 'Project Manager',
                        dataIndex : 'FeaturePM',
                        width     : 80,
                        resizable : false,
                        align     : 'center'
                    },{
						text      : 'Total User Stories',
						dataIndex : 'TotalStories',
						width     : 80,
                        resizable : false,
						align     : 'center'
					},{
						text      : 'Percent of Backlog Estimated',
						dataIndex : 'EstimatedStoriesRate',
						width     : 120,
                        resizable : false,
						align     : 'center',
						renderer  : function(val, meta, record) {
							(val >= .9) ? meta.tdCls = 'green' : (val > .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
							return '<div class="left half">' + Math.round(val * 100) + '%</div><div class="right half">' + record.get('EstimatedStories') + ' / ' + record.get('TotalStories') + '</div>';
						}
					},{
						text      : 'Percent of Backlog Scheduled',
						dataIndex : 'ScheduledStoriesRate',
						width     : 120,
                        resizable : false,
						align     : 'center',
						renderer  : function(val, meta, record) {
							(val >= .9) ? meta.tdCls = 'green' : (val > .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
							return '<div class="left half">' + Math.round(val * 100) + '%</div><div class="right half">' + record.get('ScheduledStories') + ' / ' + record.get('TotalStories') + '</div>';
						}
					},{
						text      : 'Percent of Backlog Defined',
						dataIndex : 'NonIVStoriesRate',
						width     : 120,
                        resizable : false,
						align     : 'center',
						renderer  : function(val, meta, record) {
							(val >= .9) ? meta.tdCls = 'green' : (val > .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
							return '<div class="left half">' + Math.round(val * 100) + '%</div><div class="right half">' + record.get('NonIVStories') + ' / ' + record.get('TotalStories') + '</div>';
						}
					},{
                        text      : 'Percent of Backlog Accepted',
                        dataIndex : 'AcceptedStoriesRate',
                        width     : 120,
                        resizable : false,
                        align     : 'center',
                        renderer  : function(val, meta, record) {
                            (val >= .9) ? meta.tdCls = 'green' : (val > .5) ? meta.tdCls = 'yellow' : meta.tdCls = 'red';
                            return '<div class="left half">' + Math.round(val * 100) + '%</div><div class="right half">' + record.get('AcceptedStories') + ' / ' + record.get('TotalStories') + '</div>';
                        }
                    },{
						text      : 'Blocked Stories',
						dataIndex : 'BlockedStories',
						width     : 80,
                        resizable : false,
						align     : 'center'
					}]
				});
        	}
        }
    }
});