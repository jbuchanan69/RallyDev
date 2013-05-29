// Enhanced Story Card Print - Version 0.1
// Copyright (c) 2013 Cambia Health Solutions. All rights reserved.
// Developed by Conner Reeves - Conner.Reeves@cambiahealth.com
var PANEL_WIDTH = 280;
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
        title   : 'Project Filter:',
        id      : 'leftPopout',
        region  : 'west',
        margins : '5 0 0 0',
        width   : PANEL_WIDTH,
        items: [{
            id     : 'rpmTreeContainer', 
            layout : 'fit',
            border : 0,
            flex   : 1
        }],
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        }
    },{
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        },
        collapsible : false,
        region      : 'center',
        margins     : '5 0 0 0',
        defaults    : {
            border  : 0,
            padding : 3
        },
        items: [{
            xtype   : 'container',
            layout  : 'hbox',
            id      : 'toolbar',
            margins : '3 0 0 0',
            items   : [{
                xtype    : 'container',
                layout   : 'hbox',
                flex     : 1,
                minWidth : 485,
                items    : [{
                    xtype      : 'checkbox',
                    id         : 'filterByIteration',
                    margins    : '0 5 0 3'
                },{
                    xtype      : 'rallyiterationcombobox',
                    id         : 'min_iter',
                    width      : 265,
                    fieldLabel : 'Iteration Range:',
                    labelWidth : 75,
                    listeners  : {
                        ready  : function() {
                            var me = this;
                            Ext.onReady(function() {
                                var items = App.down('#min_iter').store.data.items;
                                for (i in items) {
                                    if (me.getValue() == items[i].data._ref) {
                                        (i < items.length - 2) ? me.setValue(items[parseInt(i) + 2].data._ref) : me.setValue(items[parseInt(items.length - 1)]);
                                        App.minIterLoaded = true;
                                        return;
                                    }
                                }
                            });
                        }
                    }
                },{
                    xtype      : 'rallyiterationcombobox',
                    id         : 'max_iter',
                    fieldLabel : 'to',
                    labelWidth : 10,
                    listeners  : {
                        ready  : function() {
                            Ext.onReady(function() {
                                App.maxIterLoaded = true;
                            });
                        }
                    }
                }]
            },{
                xtype   : 'button',
                width   : 60,
                text    : 'Print',
                handler : function() {
                    Ext.onReady(function() {
                        App.printSelectedCards();
                    });
                }
            }]  
        },{
            id         : 'viewport',
            flex       : 1,
            autoScroll : true,
            style  : {
                borderTop  : '1px solid #99BCE8'
            },
        }]
    },{
        title   : 'Team Filter:',
        id      : 'rightPopout',
        region  : 'east',
        margins : '5 0 0 0',
        width   : PANEL_WIDTH,
        items: [{
            id     : 'teamTreePopout', 
            layout : 'fit',
            border : 0,
            flex   : 1
        }],
        layout: {
            type  : 'vbox',
            align : 'stretch',
            pack  : 'start',
        }
    }],

    launch: function() {
        Ext.getBody().mask('Initializing');
        App = this;
        App.rpmTree.init();
        App.teamTree.init();
        App.getIterations();
        var uiInitWait = setInterval(function() {
            if (App.minIterLoaded     &&
                App.maxIterLoaded     &&
                App.down('#rpmTree')  &&
                App.down('#teamTree') &&
                App.iterationsLoaded) {
                clearInterval(uiInitWait);
                App.down('#min_iter').addListener('change', function() {
                    if (App.down('#filterByIteration').getValue() === true) App.viewport.update();
                });
                App.down('#max_iter').addListener('change', function() {
                    if (App.down('#filterByIteration').getValue() === true) App.viewport.update();
                });
                App.down('#filterByIteration').addListener('change', App.viewport.update);
                Ext.getBody().unmask();
            }
        }, 500);
    },

    getIterations: function() {
        App.viewableTeams     = [];
        App.iterationNameHash = {};
        App.teamNameHash      = {};
        var loader = Ext.create('Rally.data.WsapiDataStore', {
            model     : 'Iteration',
            fetch     : ['Project','ObjectID','Name'],
            listeners : {
                load : function(store, data) {
                    if (data && data.length) {
                        Ext.Array.each(data, function(i) {
                            if (Ext.Array.indexOf(App.viewableTeams, i.raw.Project.ObjectID) === -1) App.viewableTeams.push(i.raw.Project.ObjectID);
                            App.iterationNameHash[i.raw.ObjectID]    = i.raw.Name;
                            App.teamNameHash[i.raw.Project.ObjectID] = i.raw.Project.Name;
                        });
                        loader.nextPage();
                    } else {
                        App.iterationsLoaded = true;
                    }
                }
            }
        });
        loader.loadPage(1);
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
                App.down('#rpmTreeContainer').add({
                    xtype         : 'treepanel',
                    allowDeselect : true,
                    store         : Ext.create('Ext.data.TreeStore', {
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
                                    autoLoad : true,
                                    model    : 'PortfolioItem/' + child_type,
                                    filters  : [{
                                        property : 'Parent.ObjectID',
                                        value    : node.raw.id
                                    }],
                                    fetch     : ['Children','LeafStoryCount','Name','ObjectID'],
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

    teamTree: {
        init: function() {
            Ext.create('Rally.data.WsapiDataStore', {
                autoLoad: true,
                model: 'Project',
                fetch: [ 'Children', 'Name', 'ObjectID' ],
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
                        App.down('#teamTreePopout').add({
                            xtype         : 'treepanel',
                            allowDeselect : true,
                            id            : 'teamTree',
                            rootVisible   : false,
                            margin        : '-1 0 0 0',
                            border        : 0,
                            layout        : 'fit',
                            store         : Ext.create('Ext.data.TreeStore', {
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
                                        fetch: [ 'Children', 'Name', 'ObjectID' ],
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
                                selectionchange: function() {
                                    App.viewport.update();
                                }
                            }
                        });     
                    }
                }
            });
        }
    },

    viewport : {
        update : function() {
            Ext.getBody().mask('Loading');
            App.viewport.validIterations = {};
            if (App.down('#filterByIteration').getValue() === true) {
                App.viewport.getIterationOIDs();
            } else {
                App.viewport.getUserStories();
            }
        },

        getIterationOIDs : function() {
            var loader = Ext.create('Rally.data.WsapiDataStore', {
                model     : 'Iteration',
                fetch     : ['ObjectID','Name'],
                filters   : [{
                    property : 'StartDate',
                    operator : '>=',
                    value    : Rally.util.DateTime.toIsoString(App.down('#min_iter').getRecord().get('StartDate'))
                },{
                    property : 'StartDate',
                    operator : '<=',
                    value    : Rally.util.DateTime.toIsoString(App.down('#max_iter').getRecord().get('StartDate'))
                }],
                listeners : {
                    load : function(store, data) {
                        if (data && data.length) {
                            Ext.Array.each(data, function(i) {
                                App.viewport.validIterations[i.raw.ObjectID] = i.raw.Name;
                            });
                            loader.nextPage();
                        } else {
                            App.viewport.getUserStories();
                        }
                    }
                }
            });
            loader.loadPage(1);
        },

        getUserStories : function() {
            var filters = [{
                property : '__At',
                value    : 'current'
            },{
                property : '_TypeHierarchy',
                value    : 'HierarchicalRequirement'
            },{
                property : 'Children',
                value    : null
            },{
                property : 'Project',
                operator : 'in',
                value    : App.viewableTeams
            }];
            if (App.down('#rpmTree').getSelectionModel().getSelection().length == 1) {
                filters.push({
                    property : '_ItemHierarchy',
                    operator : 'in',
                    value    : App.down('#rpmTree').getSelectionModel().getSelection()[0].raw.id
                });
            }
            if (App.down('#teamTree').getSelectionModel().getSelection().length == 1) {
                filters.push({
                    property : '_ProjectHierarchy',
                    operator : 'in',
                    value    : App.down('#teamTree').getSelectionModel().getSelection()[0].raw.id
                });
            }
            if (App.down('#filterByIteration').getValue() === true) {
                filters.push({
                    property : 'Iteration',
                    operator : '!=',
                    value    : null
                });
            }
            App.viewport.userStories = [];
            Ext.create('Rally.data.lookback.SnapshotStore', {
                autoLoad : true,
                pageSize : 1000000,
                fetch    : ['ObjectID','Iteration','Project','Name','PlanEstimate','_UnformattedID'],
                filters  : filters,
                listeners : {
                    load : function(store, data, success) {
                        Ext.Array.each(data, function(i) {
                            if (App.down('#filterByIteration').getValue() === false || App.viewport.validIterations[i.raw.Iteration] !== undefined) {
                                i.raw.Iteration = App.iterationNameHash[i.raw.Iteration] || 'N/A';
                                i.raw.Project   = App.teamNameHash[i.raw.Project];
                                App.viewport.userStories.push(i.raw);
                            }
                        });
                        App.viewport.drawCheckboxGroup();
                    }
                }
            });
        },

        drawCheckboxGroup : function() {
            Ext.getBody().unmask();
            
            var items = [];
            Ext.Array.each(App.viewport.userStories, function(i) {
                items.push({
                    boxLabel   : '<a href="https://rally1.rallydev.com/#/detail/userstory/' + i.ObjectID + '" target="_blank">US' + i._UnformattedID + '</a> - ' + i.Name,
                    name       : 'cards',
                    inputValue : i,
                    checked    : true
                });
            });

            App.down('#viewport').removeAll();
            App.down('#viewport').add({
                xtype    : 'checkboxgroup',
                id       : 'selectedCards',
                columns  : 1,
                vertical : true,
                items    : items
            });
        }
    
    },

    printSelectedCards : function() {
        var cards = App.down('#selectedCards').getValue().cards;
        if (Ext.typeOf(cards) == 'object') cards = [cards];

        var cardsHTML = '<div class="cards">';
        for (var i = 1; i <= cards.length; i++) {
            cardsHTML += '<div class="card"><div class="stripe"><div class="floatLeft">US' + cards[i - 1]._UnformattedID + '</div><div class="floatRight">' + cards[i - 1].Project.substring(0,22) + ((cards[i - 1].Project.length > 22) ? '...' : '') + '</div></div><div class="cardBody"><div class="storyName">' + cards[i - 1].Name + '</div></div><div class="stripe"><div class="floatLeft">' + cards[i - 1].Iteration + '</div><div class="floatRight">' + cards[i - 1].PlanEstimate + '</div></div></div>';
            if (i % 4 == 0 || i == cards.length) {
                cardsHTML += '</div>';
                if (i < cards.length) cardsHTML += '<div class="cards">';
            }
        }

        var options = "toolbar=1,menubar=1,scrollbars=yes,scrolling=yes,resizable=yes,width=930,height=650";
        var printWindow = window.open('', '', options);
        var doc = printWindow.document;

        doc.write('<html><head><title>Story Card Print</title>');
        doc.write('<style>                                           \
            .cards {                                                 \
                width            : 9.3in;                            \
                height           : 6.84in;                           \
                page-break-after : always;                           \
                clear            : both;                             \
                border           : 1px dotted black;                 \
            }                                                        \
            .card {                                                  \
                float            : left;                             \
                height           : 3.12in;                           \
                margin           : .1in;                             \
                overflow         : hidden;                           \
                position         : relative;                         \
            }                                                        \
            .stripe {                                                \
                font             : .25in arial,helvetica,sans-serif; \
                padding          : .05in;                            \
                line-height      : .3in;                             \
                height           : .3in;                             \
                width            : 4.32in;                           \
                border           : 1px solid black;                  \
            }                                                        \
            .floatLeft {                                             \
                float            : left;                             \
            }                                                        \
            .floatRight {                                            \
                float            : right;                            \
            }                                                        \
            .cardBody {                                              \
                display          : table;                            \
                font             : .2in arial,helvetica,sans-serif;  \
                height           : 2.18in;                           \
                padding          : .05in;                            \
                border-left      : 1px solid black;                  \
                border-right     : 1px solid black;                  \
                width            : 4.32in;                           \
            }                                                        \
            .storyName {                                             \
                display          : table-cell;                       \
                vertical-align   : middle;                           \
                text-align       : center;                           \
            }                                                        \
        </style>');
        doc.write('</head><body class="landscape">');
        doc.write(cardsHTML);
        doc.write('</body></html>');
        doc.close();
        printWindow.print();
    }

});