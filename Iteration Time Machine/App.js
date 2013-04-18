// Iteration Time Machine - Version 2.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [{
        xtype  : 'container',
        height : 30,
        layout : {
            align : 'stretch',
            type  : 'hbox'
        },
        items  : [{
            xtype : 'container',
            flex  : 1,
            id    : 'leftToolbar'
        },{
            xtype : 'container',
            id    : 'iterBoxContainer'
        },{
            xtype : 'container',
            flex  : 1,
            id    : 'rightToolbar'
        }]
    },{
        xtype  : 'container',
        flex   : 1,
        layout : {
            align : 'stretch',
            type  : 'hbox'
        },
        items  : [{
            xtype  : 'container',
            flex   : 1,
            id     : 'leftGridContainer',
            margin : '0 5px 0 0'
        },{
            xtype  : 'container',
            flex   : 1,
            id     : 'rightGridContainer',
            margin : '0 0 0 5px'
        }]
    }],

    launch: function() {
        App      = this;
        App.mask = new Ext.LoadMask(Ext.getBody());
        App.down('#iterBoxContainer').add({
            xtype     : 'rallyiterationcombobox',
            id        : 'iterBox',
            margin    : '5px 0 0 14px',
            listeners : {
                ready  : App.onIterChange,
                change : App.onIterChange
            }
        });
    },

    onIterChange: function() {
        //Clear old results
        App.down('#leftToolbar').removeAll();
        App.down('#rightToolbar').removeAll();

        var iterStart = App.down('#iterBox').getRecord().get('StartDate');
        var iterEnd   = App.down('#iterBox').getRecord().get('EndDate');
        var now       = new Date();

        //Add left date picker
        App.down('#leftToolbar').add({
            xtype: 'datefield',
            id: 'leftDate',
            cls: 'filter',
            value: iterStart.getTime() > now.getTime() ? now : iterStart,
            showToday: false,
            listeners: {
                change: function() { App.doQuery(); },
                added:  function() {
                	//Add left uniqe checkbox
                	App.down('#leftToolbar').add({
                        xtype      : 'checkbox',
                        id         : 'leftUnique',
                        cls        : 'filter',
                        fieldLabel : 'Unique',
                        labelWidth : 35,
                        listeners  : {
							change : function() { App.doQuery(); }
						}
		            });
                	//Add right date picker
                	App.down('#rightToolbar').add({
                        xtype     : 'datefield',
                        id        : 'rightDate',
                        cls       : 'filter',
                        value     : iterEnd.getTime() > now.getTime() ? now : iterEnd,
                        showToday : false,
                        listeners : {
			                change: function() { App.doQuery(); },
			                added:  function() {
			                	//Add left uniqe checkbox
			                	App.down('#rightToolbar').add({
                                    xtype      : 'checkbox',
                                    id         : 'rightUnique',
                                    cls        : 'filter',
                                    fieldLabel : 'Unique',
                                    labelWidth : 35,
                                    listeners  : {
                                        change : function() { App.doQuery(); },
                                        added  :  function() { App.doQuery(); }
									}
					            });
			                }
			            }
			        });
                }
            }
        });
    },

    doQuery: function() {
    	var iterOIDs = [];
        App.mask.show();
    	//Get iteration OIDs
    	Ext.create('Rally.data.WsapiDataStore', {
            autoLoad  : true,
            model     : 'Iteration',
            fetch     : [ 'Name', 'ObjectID' ],
            filters   : [{
                property : 'Name',
                value    : App.down('#iterBox').getRecord().get('Name')
            }],
    		listeners : {
    			load : function(store, data) {
    				if (data && data.length) {
	    				//Using the collected OIDs, compose a list for the lookback API
	    				Ext.Array.each(data, function(iter) {
	    					iterOIDs.push(iter.get('ObjectID'));
	    				});
	    				//Now that the OIDs have been loaded, get the stories for the first and second date
	    				var leftDate    = App.down('#leftDate').getValue();
	    				var rightDate   = App.down('#rightDate').getValue();
	    				var leftUnique  = App.down('#leftUnique').getValue();
	    				var rightUnique = App.down('#rightUnique').getValue();
	    				getStoriesFrom(leftDate, function(leftStories) {
	    					getStoriesFrom(rightDate, function(rightStories) {
	    						if (leftUnique) {
	    							var removeFromLeft = [];
	    							for (storyOID in leftStories) {
	    								if (rightStories[storyOID] != undefined)
	    									removeFromLeft.push(storyOID);
	    							}
	    						}
                                if (rightUnique) {
                                    var removeFromRight = [];
                                    for (storyOID in rightStories) {
                                        if (leftStories[storyOID] != undefined)
                                            removeFromRight.push(storyOID);
                                    }
                                }
	    						//Remove non-unique stories
	    						for (i in removeFromLeft)  { delete leftStories[removeFromLeft[i]];   }
	    						for (i in removeFromRight) { delete rightStories[removeFromRight[i]]; }
                                //Draw grids
                                App.mask.hide();
                                drawGrid(leftStories, 'left');
                                drawGrid(rightStories, 'right');
	    					});
	    				});
	    			}
    			}
    		}
    	});

    	function getStoriesFrom(date, callback) {
    		var stories = {};
            date = new Date(date.getTime() + 86399999); //Add 24 hours to include stories from the selected day
    		Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad : true,
                pageSize : 1000000,
                fetch    : ['Name', 'PlanEstimate', '_UnformattedID'],
                filters  : [{
                    property : 'Iteration',
                    operator : 'in',
                    value    : iterOIDs
                },{
                    property : '__At',
                    value    : Rally.util.DateTime.toIsoString(date)
                }],
                listeners : {
                	load : function(store, data) {
                		Ext.Array.each(data, function(US) {
                			stories[US.get('ObjectID')] = {
                                id     :  'US' + US.get('_UnformattedID'),
                                name   :  US.get('Name'),
                                points :  US.get('PlanEstimate')
							};
                		});
                		callback(stories);
                	}
                }
    		});
    	}

        function drawGrid(storyObj, side) {
            var storeData = [];
            for (storyOID in storyObj) {
                storeData.push(storyObj[storyOID]);
            }
            App.down('#' + side + 'GridContainer').removeAll();
            App.down('#' + side + 'GridContainer').add({
                xtype : 'rallygrid',
                store : Ext.create('Rally.data.custom.Store', {
                    data     : storeData,
                    pageSize : 25,
                    sorters  : [
                        { property: 'id',      direction: 'ASC' }
                    ],
                }),
                columnCfgs : [
                    { text: 'ID',      dataIndex: 'id',      width: 60  },
                    { text: 'Name',    dataIndex: 'name',    flex: 1    },
                    { text: 'Points',  dataIndex: 'points',  width: 45  }
                ]
            });
        }
    }
});