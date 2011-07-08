// ==UserScript==
// @name           Tweetfilter
// @namespace      Chilla42o
// @description    Tweetfilter is a highly customizable timeline filter for the twitter.com web client
// @version        2.0
// @include        http://twitter.com/
// @include        https://twitter.com/
// @include        http://twitter.com/#*
// @include        https://twitter.com/#*
// @match          http://twitter.com/
// @match          https://twitter.com/
// @match          http://twitter.com/#*
// @match          https://twitter.com/#*
// ==/UserScript==

// Copyright (c) 2009-2011 Chilla42o <tweetfilterjs@gmail.com>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.


var TweetfilterPrototype = function() {

  function Tweetfilter() {
// <debug>
    this.debug = true; //turn on debug. use firefox with firebug. will be _very_ verbous with standard settings. will probably slow down the script.
                        //if using debug, change _debuglevels, _debugfunctions and _debugskipfunctions to your needs. You may also want to set firebugs log limit to 5000 (500 is default).
    this._debuglevels = 'DLIWE'; //each char is a debug level - include in output (in order of importance): D=Debug, L=Log, I=Info, W=Warning, E=Error, empty string = show only function headers
    this._debugfunctions = [];// ['refreshfriendstatus', 'refreshcss', 'refreshfriends','refreshcursor','cursorfetched','cursorfetched']; //which functions to debug (whitelist). empty array = debug all functions
    this._debugskipfunctions = ['checktweet', 'parselinks']; //which functions NOT to debug (blacklist) - only function header is shown. empty array = debug all functions
// </debug>   
    this._heartbeat = 250; //amount of ms between poll ticks which perform various filter actions. don't set below 50
    this.version = '2.0'; //current script version

    this.options = { /* default option settings */
      /* widget options */
      'filter-minimized': false,  /* widget layout toggle state */
      /* global options */
      'hide-topbar': false,  /* auto-hide top bar */
      'hide-tweetbox': false,     /* main tweet box */
      'hide-question': true,     /* hide "What's happening" */
      'alert-message': true,      /* message alert when new direct messages received */
      'alert-sound-message': true,/* play sound when new direct messages received */
      'alert-mention': true,/* message alert when new mentions arrived */
      'alert-sound-mention': true,/* play sound when new direct messages received */
      /* options changing the dashboard */
      'compact-activities': false,  /* compact activities */
      'hide-wtf': false,     /* hide who to follow */
      'hide-trends': false,  /* hide trends */
      'hide-ad': true,  /* hide advertising */
      'hide-options': false, /* hide filter options */
      'hide-filters': false, /* hide filter keywords */
      'minify-menu': false,  /* show only essential dashboard menu options */
      'fixed-dashboard': false,        /* fixed dashboard */
      /* options changing the stream */
      'filter-disabled': false, /* disable filter */
      'filter-inverted': false,   /* invert filter */
      'skip-me': true,       /* filter should skip my posts */
      'skip-mentionsme': true,  /* filter should skip tweets mentioning me */
      'filter-replies': false,  /* filter all replies */
      'filter-links': false,    /* filter all tweets with links */
      'filter-retweets': false, /* filter all retweets */
      'filter-media': false,    /* filter all media */
      'show-navigation': true,  /* show draggable top/bottom link menu */
      'show-via': true,         /* show tweet source */
      'show-tab': true,         /* show "filtered"-tab */
      'show-br': true,          /* show line breaks in tweets */
      'add-selection': true,    /* show add to filter menu after simple text selection in tweets */
      'expand-last': false,       /* expand last tweet (dashboard) */
      'expand-new': true,       /* expand new tweets */
      'expand-links': false,    /* show expanded links */
      'small-links': false,     /* show small links */
      'highlight-mentionsme':true, /* highlight replies to me */
      'show-friends':false,     /* show who follows you and who you follow */
      'clear-stream-cache': true /* reset stream cache after page switch - for speed issues */
    };                     
    this.disabledoptions = []; //currently disabled options. for check in getoption()
    //dashboard components toggled by options
    this.components = [
       { //trends list
         css: 'trends', //class added to component
         path: 'div.trends-inner', //what to search for to identify the component
         option: 'hide-trends' //which option depends on the component, will be activated when it's found
       },
       { //who to follow
         css: 'wtf',
         path: 'ul.recommended-followers.user-rec-component',
         option: 'hide-wtf'
       },
       { //latest tweet
         css: 'latest',
         path: 'div.tweet-activity div.latest-tweet',
         option: 'expand-last'
       },
       { //similar to
         css: 'similarto',
         path: 'div.user-rec-inner-similarities',
         option: 'hide-similarto'
       },
       { //following
         css: 'following',
         path: 'div.following-activity-full',
         option: 'expand-following'
       },
       { //your activities
         css: 'activities',
         path: 'div.your-activity.following-activity',
         option: 'compact-activities'
       },
       { //advertising
         css: 'ad',
         path: 'div.definition p.promo',
         option: 'hide-ad'
       },
       { //dashboard menu
         css: 'menu',
         path: 'div.footer.inline-list',
         option: ['minify-menu']
       },
       { //user stats
         css: 'stats',
         path: 'ul.user-stats'
       },
       { //newest list members
         css: 'listmembers',
         path: 'div.newest-list-members'
       },
       { //more lists by user
         css: 'morelists',
         path: 'div.more-lists'
       }
    ];
    
    this.queries = [];  /* parsed queries (objects) */
    this.exclusive = []; /* exclusive filtered queries (ids) */
    
    this.friendstatus = {expires: 0};
    this.cursors = {
      /* followerids: { fetching: true, nextcursor:'123456420' } */ 
    }; //cursor information for fetch functions
    
    this.status = {
      messagesinceid: -1, //id of last mention, is 0 if no mentions found
      mentionsinceid: -1, //id of last direct message, is 0 if no messages found
      foundcomponents: [],  //which components were found in findcomponents()
      initialized: false  //is widget created and settings loaded: influences setoption and poll behaviour
    };
    
    this.timeids = { //timeout and/or interval ids for special functions
    }
    
    this.polling = {
      tick: 0,         //count of ticks executed, mainly for debug
      timeoutid: -1,   //id returned by settimeout for next poll, to avoid multiple timeout calls, -1=can repoll
      intervalid: -1,  //id of poll that happens once every minute (checking for new messages etc.)
      
      suspend: false,  //immediately stop polling
      stop: true,      //stop poll after run of _poll()
      busy: false,     //is poll currently busy (already processing)
      working: false,
      events: { //possible events executed during poll. order matters!
        refreshoptions: false, //set enabled/disabled options
        parseitems: false, //parse through cached tweets (outside the dom)
        parsestream: false,  //parse through displayed tweets (in the dom)
        findcomponents: false, //try to find dashboard components
        parselinks: false,     //pick up links and expand or collapse them
        setstreamtitle: false, //refresh stream title on the widget and the stream
        addclass: false,       //add class to <body> - used for layout options, spares css recreation
        removeclass: false,    //remove class from <body>
        refreshfriends: false, //fetch users following and followers
        refreshfriendstatus: false,        
        refreshcss: false,     //refresh inline stylesheets
        refreshfilterlist: false,  //refresh the list of filters and excludes on the widget
        checkreceived: false,  //check for new messages / mentions
        removeselection: false  //remove text selection
      },
      running: {}, //events currently running during the tick. populated from "queued" before tick is executed
      queued: {} //queued action events, in no specific order. added through method "poll()"
    };

    this.expanded = {}; /* expanded urls */
    this.user = {}; //current user info
    this.nextid = 1;    /* next unique id for query. always incremented */
    this.queries = [];  /* parsed queries */
    this.stream = {
      key: '', //unique stream cachekey.
      mode: '', //tweets, user, links, relevance
      itemtype: '', //tweets, user
      status: '', //do not rely on checking (only) this var
      title: '',
      user: ''
    };
    this.stopchars = ' (){}[].,;-_#\'+*~´`?\\/&%$§"!^°'; //possible chars delimiting a phrase, for exact search. spares expensive regex match
    this.initretries = 10; //how many times try to initialize before giving up
    this.initialize();
    
  }
  
  //check minimum requirements, bind routed event and switch to current stream
  Tweetfilter.prototype.initialize = function() {   
    var that = this, has = 'hasOwnProperty', get = 'getElementById';
    if (window.jQuery && window.twttr) {
      if (!twttr.loggedIn) {
        return false;
      }
      if(document[get]('top-stuff') && document[get]('page-outer') && 
         twttr[has]('router') && twttr[has]('$doc') && twttr[has]('$elements') && twttr[has]('app') && 
         twttr[has]('currentUser'))
      {
        if (!window.localStorage || !JSON) { //browser must have local storage and native json
          this.showmessage('Tweetfilter can\'t work correctly on this browser. <br />It would probably work fine on latest <a href="http://www.mozilla.com/firefox">Firefox</a>, '+
                           '<a href="http://www.google.com/chrome">Chrome</a> or <a href="http://www.opera.com">Opera</a>.', {resident:true});
          return false;
        }
        this.fastbrowser = $.browser.webkit || ($.browser.mozilla && parseFloat($.browser.version.substr(0,3)) > 1.9);  //disable stream cache per default for all except webkit and firefox 4+
        this.options['clear-stream-cache'] = !this.fastbrowser;
        this.refreshuser();
        $('head').append( //create style containers
          '<style id="tf-layout" type="text/css"></style>', //contains main widget layout
          '<style id="tf-friends" type="text/css"></style>', //display friend status, updated separately
          '<style id="tf-filter" type="text/css"></style>' //hide and show single tweets according to filters
        );
        $('div#top-stuff').attr({
          'data-over':0, //is mouse over top bar
          'data-focused':0 //is search field focused
        }).hover(function() {
          var topbar = $(this);
          topbar.attr('data-over', '1');
        }, function() {
          var topbar = $(this);
          topbar.attr('data-over', '0');
        }).delegate('#search-query', 'focus', function() {
          $('div#top-stuff').attr('data-focused', '1');
        }).delegate('#search-query', 'blur', function() {
          $('div#top-stuff').attr('data-focused', '0');
        });
        //don't show hidden topbar when hovering a message notification
        $('#message-drawer').bind('mouseenter', function(e) { 
          e.stopPropagation();
          e.preventDefault();
          return false; 
        });
        window.scrollTo(0,0); //scroll to the top
        twttr.router.bind('routed', function() { 
          that.refreshfiltercss();
        });
        $(document).bind('ajaxSuccess', function(event, request, settings) { 
          that.twttrajaxevent(event, request, settings); 
        }); //watch for ajax requests
        this.createwidget();
        this.loadsettings();
        this.poll('refreshcss', ['layout']);
        this.poll('refreshfriends');
        this.poll('refreshfilterlist');
        this.poll('findcomponents', 3);
        this.status.initialized = true;
        this._poll();
        return true;
      } else _D('F:initialize', 'W:required twttr components not loaded, reinitializing.');
    } else _D('F:initialize', 'W:jquery or twttr not loaded, reinitializing');
                                                                                                    _D('F:initialize', 'reinitialize, ', this.initretries, 'retries left');
    if (this.initretries--) {
      setTimeout(function() {
        that.initialize();
      }, 1000); //reinitialize
      return false;
    }
    if (typeof twttr !== 'undefined') this.showmessage('Tweetfilter failed to initialize. You may try to refresh the page.');
    return false;
  };
  
  Tweetfilter.prototype.waitforstream = function() {
    var isloaded = true;
    try { 
      this.cp = twttr.app.currentPage();
      if (!this.cp.streamManager.hasOwnProperty('filtered')) {
        this.cp.streamManager.bind('newItemsCountChanged switchTo', twttr.bind(this, function(e) { 
                                                                                                    _D('F:twttr', 'W:stream event triggered', e, arguments);
          this.poll('parseitems'); 
        }));
        this.cp.streamManager.filtered = true;
      }
      var cs = this.cp.streamManager.getCurrent();
      var isprotected = cs.params.hasOwnProperty('canViewUser') ? !cs.params.canViewUser : false; 
      isloaded = (isprotected || cs.$node.find('.stream-end').length || cs.items.length); //&& !cs._getMoreOldItemsLock && cs._loadedStreamOnce;
    } catch(e) {
      isloaded = false;
    }
    if (!isloaded) {
      if (this.stream.status !== 'loading') {
                                                                                                    _D('F:waitforstream', 'W:stream is loading, resetting filter css');
        this.stream.status = 'loading';
        this.refreshfiltercss(true);
      }
      return false;
    } 
    if (!cs.hasOwnProperty('filtered')) {
      cs.bind('didTweet doneLoadingMore streamEnd', twttr.bind(this, function(e) {this.poll('parseitems');}));
      cs.$node.delegate('a.tf', 'mousedown click', twttr.bind(this, function(e) {this.tweetactionsclick(e);})) 
              .delegate('.tf-via > a', 'click', twttr.bind(this, function(e) {this.tweetclickvia(e);}))
              .delegate('div.tweet-text', 'mousedown', twttr.bind(this, function(e) {this.tweettextmousedown(e);}))
              .delegate('div.tweet-text', 'mouseup click', twttr.bind(this, function(e) {this.tweettextmouseup(e);}))
              .delegate('ul.tf-menu', 'mouseleave', twttr.bind(this, function(e) {this.filtermenuleave(e);}));
      cs.filtered = true;
    }
    if (this.stream.key !== cs._cacheKey) {
      if (this.stream.status === 'switching') {
                                                                                                    _D('F:waitforstream', 'W: already switching, aborting!');
        return false;
      }
      if (this.options['clear-stream-cache'] && this.stream.key && this.cp.streamManager.streams.hasOwnProperty(this.stream.key)) {
                                                                                                    _D('F:waitforstream', 'W: clearing cache of previous stream', this.stream.key);
        
        delete this.cp.streamManager.streams[this.stream.key];
        delete this.cp.streamManager.streams[cs._cacheKey];
      }
      this.stream.status = 'switching';
                                                                                                    _D('F:waitforstream', 'W: now loading ', decodeURIComponent(cs._cacheKey), ' - was before: ', decodeURIComponent(this.stream.key));
      var streamkey = decodeURIComponent(cs._cacheKey);
      var pos = streamkey.indexOf('{');
      if (pos !== -1) {
        this.stream.params = JSON.parse(streamkey.substr(pos));
        this.stream.namespace = streamkey.substr(0, pos);
      } else {
        this.stream.namespace = streamkey;
        this.stream.params = {};
      }
      this.stream.isprotected = this.stream.params.hasOwnProperty('canViewUser') && this.stream.params.canViewUser === false;
      var whose = !this.stream.params.hasOwnProperty('screenName') || this.stream.params.screenName.toLowerCase() === this.user.name ? 'Your ' : '@'+this.stream.params.screenName+"'s ";
      this.stream.itemtype = cs.streamItemType;
      this.stream.mode = this.stream.params.hasOwnProperty('mode') ? this.stream.params.mode : this.stream.itemtype;
      this.stream.activetab = this.cp._activeTab;
      var filter = {retweets: true};
      switch(this.stream.namespace) {
        case 'Home':
          this.stream.title = 'Home timeline'; 
          break;
        case 'Mentions':
          this.stream.title = 'Mentions'; 
          break;
        case 'RetweetsByYou':
          this.stream.title = 'Retweets by you'; 
          filter.retweets = false;
          break;
        case 'RetweetsByOthers':
          this.stream.title = 'Retweets by others'; 
          filter.retweets = false;
          break;
        case 'YourTweetsRetweeted':
          this.stream.title = 'Your tweets, retweeted'; 
          break;
        case 'Search':
          this.stream.title = 'Search'; 
          switch (this.stream.params.mode) {
            case 'relevance':
              this.stream.title += ' <em>top tweets</em>'; 
              break;
            case 'tweets':
              this.stream.title += ' <em>all tweets</em>'; 
              break;
            case 'links':
              this.stream.title += ' <em>tweets with links</em>'; 
              break;
          }
          break;
        case 'List':
          this.stream.title = 'List <b>'+this.stream.params.listSlug+'</b>'; 
          break;
        case 'OwnLists':
          this.stream.title = whose+' Lists'; 
          break;
        case 'MessageStream':
          this.stream.title = 'Messages'; 
          break;
        case 'User':
          this.stream.title = whose+'Tweets'; 
        break;
        case 'Favorites':
          this.stream.title = whose+'Favorites'; 
        break;
        case 'Following':
          this.stream.title = 'Following'; 
        break;
        case 'Friends':
          this.stream.title = whose+'Friends'; 
        break;
        case 'FollowingTweets':
          this.stream.title = whose+'Timeline'; 
        break;
        case 'Followers':
          this.stream.title = whose+'Followers'; 
        break;
        case 'SocialContextStream': //you both follow
          this.stream.title = 'Your and '+whose+'Friends'; 
        break;
        case 'ListMembers':
          this.stream.title = 'Members of list <b>'+this.stream.params.listSlug+'</b>'; 
        break;
        case 'ListFollowers':
          this.stream.title = 'Followers of list <b>'+this.stream.params.listSlug+'</b>'; 
        break;
        case 'UserRecommendationsStream':
          this.stream.title = 'Who to follow: Suggestions'; 
        break;
        case 'SuggestionCategoriesStream':
          this.stream.title = 'Who to follow: Interests'; 
        break;
        case 'ContactImportServices':
          this.stream.title = 'Who to follow: Import contacts'; 
        break;
        default:
          this.stream.title = 'unknkown: '+this.stream.namespace;
          break;
      }

      this.stream.key = cs._cacheKey;   
      this.stream.loading = false;
      this.stream.status = 'ready';
      this.polling.suspend = false;
      this.polling.busy = false;
      this.poll('refreshoptions');
      this.poll('parseitems');  
      this.poll('parselinks');  
      this.poll('findcomponents', 3);
      this.poll('refreshcss', ['filter', 'layout']);
      this.poll('setstreamtitle');            
                                                                                                    _D('F:waitforstream', 'W:stream switched', decodeURIComponent(this.stream.key));
      return true;
    } else { //stream is loaded
                                                                                                    _D('F:waitforstream', 'I:stream '+this.stream.namespace+' is ready');
      return true;
    }
                                                                                                    _D('F:waitforstream', 'W:stream is still loading');
    return false;      
  };
  
  Tweetfilter.prototype.refreshoptions = function() {
    var exclusivemode = this.exclusive.length > 0;
    if (this.stream.itemtype === 'tweet' && !this.options['filter-disabled']) {
      this.enableoption('filter-retweets', this.stream.namespace !== 'RetweetsByOthers' && this.stream.namespace !=='RetweetsByYou');
      this.enableoption('filter-links', !this.stream.params.hasOwnProperty('mode') || this.stream.params.mode !== 'links');
      this.enableoption(['filter-inverted'], !exclusivemode);
      this.enableoption(['filter-replies', 'filter-media'], true);
      this.enableoption(['skip-mentionsme'], this.stream.namespace!=='Mentions' && !exclusivemode);
      this.enableoption(['show-friends'], this.stream.namespace!=='YourTweetsRetweeted' && !(this.stream.namespace === 'User' && 
                                          this.stream.params.screenName.toLowerCase() === this.user.name));
      this.enableoption(['skip-me'], !exclusivemode && this.stream.namespace!=='YourTweetsRetweeted' && 
                                     !(this.stream.namespace === 'User' && this.stream.params.screenName.toLowerCase() === this.user.name));
      this.enableoption(['add-selection'], true);
    } else {
      this.enableoption(['highlight-mentionsme'], this.stream.itemtype === 'tweet');
      this.enableoption(['filter-inverted', 'filter-replies', 'filter-media', 'filter-retweets', 'skip-me', 'show-friends', 'skip-mentionsme', 'add-selection'], false);
    }
    return true;
  };
  

  Tweetfilter.prototype.streamready = function() {
    return this.stream.status === 'ready';
  };
  
  //queue (and cleanup) events for next poll, fire poll if currently idle
  Tweetfilter.prototype.poll = function(event, params) {
    if (arguments.length > 0) {
      if (typeof params === 'undefined') {
        params = true;
      }
      if (this.polling.events.hasOwnProperty(event)) {
                                                                                                    _D('F:poll', 'queueing', event, ' for tick',this.polling.tick+1,'with params:', params);
        switch(typeof params) {
          case 'object': //merge object parameter
            if (typeof this.polling.queued[event] === 'object') { //array
              for (var p=0,len=params.length;p<len;p++) {
                if ($.inArray(params[p], this.polling.queued[event]) === -1) {
                  this.polling.queued[event].push(params[p]);
                }
              }
              if (this.status.initialized) this._poll();
              break;
            }
            //not an params array, pass anything but false to the poll queue
          default:
            this.polling.queued[event] = params;
            if (this.status.initialized && params !== false) {
              this._poll();
            }
          break;
        }
                                                                                                    _D('F:poll', 'queued event ', event, ', params:', this.polling.queued[event]);
      }
    }
  };
  
 
  //core poll event: execute queued events in predefined order, detect stream change. stop polling if no events left.
  Tweetfilter.prototype._poll = function() {
    if (!this.polling.busy) {
      if (!this.polling.working) {
        this.polling.working = true;
        this.widget.toggleClass('busy', true);
      } 
      var params = false, result, repeating = false, runsleft = 0;
                                                                                                    _D('F:_poll', 'I:running poll tick', ++this.polling.tick);
      this.polling.busy = true;      
      this.polling.running = $.extend({}, this.polling.running, this.polling.queued);
      this.polling.queued = {}
      this.polling.stop = true;
      for (var e in this.polling.events) {
        if (this.polling.suspend) {
          this.polling.working = false;
          this.widget.removeClass('busy');

                                                                                                    _D('F:_poll', 'W:polling suspended by trigger!');
          return;        
        }
        if (this.polling.running.hasOwnProperty(e) && typeof this[e] === 'function' && this.polling.running[e] !== false) {
          if (typeof this.polling.running[e] === 'number') {
            runsleft = this.polling.running[e]--;
            repeating = true;
            params = false;
          } else {
            repeating = false;
            params = this.polling.running[e];
          } 
          if ((this.waitforstream() && (result = this[e](params))) || (repeating && runsleft <= 0)) {
                                                                                                    _D('F:_poll', 'I:called function', e, 'returned', result,', repeating call:', repeating, ' - runs left', runsleft);
            this.polling.running[e] = false;
          } else {
                                                                                                    _D('F:_poll', 'W:called function', e, 'returned', result, 'requeueing! repeating call: ', repeating, ' - runs left: ', runsleft);
            this.polling.stop = false;
            if (!this.streamready()) {
                                                                                                    _D('F:_poll', 'W:stream is not ready, breaking!');
              break; 
            }
          }
        }
      }
      for (var q in this.polling.queued) {
                                                                                                    _D('F:_poll', 'W:NOT stopping, found queued:', q, this.polling.queued);
        this.polling.stop = false;
        break;
      }
      if (!this.polling.stop) {
                                                                                                    _D('F:_poll', 'W:breathing before next tick');
        this._breathe();
        return;
      } else {
                                                                                                    _D('F:_poll', 'W:stopping, nothing queued!');
      }
      this.widget.removeClass('busy');
      
      this.polling.working = false;
                                                                                                    _D('F:_poll', 'W:polling stopped.');
      this.polling.busy = false;
    }                                                                                               
  };
  
  //give a break before next poll
  Tweetfilter.prototype._breathe = function() {
                                                                                                    _D('F:_breathe', 'D:breathing '+this._heartbeat+'ms in tick '+this.polling.tick+'!');
    if (this.polling.timeoutid === -1) {
      this.polling.timeoutid = setTimeout(twttr.bind(this, function () {
        this.polling.busy = false;
        this.polling.timeoutid = -1;
        this._poll();
      }), this._heartbeat);
    } else _D('F:_breathe', 'D:NOT repolling tick '+this.polling.tick+', already queued!');
  };
  
  Tweetfilter.prototype.refreshuser = function() {
    this.user = {
      id: twttr.currentUser.idStr, //id used as namespace for settings.
      name: twttr.currentUser.screenName.toLowerCase(), //lowercase name used for matches
      screenname: twttr.currentUser.screenName
    };
  };
  
  Tweetfilter.prototype.refreshcolors = function() {
    this.colors = {
      background: '#'+twttr.currentUser.profileBackgroundColor,
      link: '#'+twttr.currentUser.profileLinkColor,
      border: '#'+twttr.currentUser.profileSidebarBorderColor,
      fill: '#'+twttr.currentUser.profileSidebarFillColor,
      text: '#'+twttr.currentUser.profileTextColor,
      reply: '#FFFAB4',
      darktext: '#444',
      lighttext: '#999'
    };
  };
  
  //load settings from local storage. executed after widget was created
  Tweetfilter.prototype.loadsettings = function(imported) {
                                                                                                    _D('F:loadsettings', this.user, twttr.currentUser.id, twttr.currentUser.screenName);
    if (!this.user.hasOwnProperty('id') || this.user.id != twttr.currentUser.id) {
      this.refreshuser();
    }
    var settings = this.getvalue(':TWEETFILTER:', {});
    if (typeof settings[this.user.id] === 'undefined') {
      settings[this.user.id] = {};
    }
    if (typeof imported !== 'undefined') {
      settings = imported;
    } else {
      settings = settings[this.user.id];
    }
                                                                                                    _D('F:loadsettings','loaded:', settings);
    if (typeof imported === 'undefined') {
      
      this.queries = [];
      if (typeof settings.queries === 'undefined') {
        settings.queries = [];
      }
      if (typeof settings.options === 'undefined') {
        settings.options = {};
      }
      for (var q=0,len=settings.queries.length;q<len;q++) {
        if (settings.queries[q].hasOwnProperty('query')) {
          this.addquery(settings.queries[q].query, settings.queries[q].enabled);
        }
      }
      for (var option in this.options) {
        if (typeof settings.options[option] === typeof this.options[option]) {
          this.setoption(option, settings.options[option], true);
          $('[data-option='+option+']', this.widget).toggleClass('checked', this.options[option]);
          if (option === 'filter-inverted') {
            $('.passed a[data-option="'+option+'"]', this.widget).toggleClass('checked', !this.options[option]);
          }
        }
      }
      if (typeof settings.friendstatus != 'undefined') {
        this.friendids = settings.friendstatus;
      }
      this.status.messagesinceid = settings.hasOwnProperty('messagesinceid') ? settings.messagesinceid : -1;
      this.status.mentionsinceid = settings.hasOwnProperty('mentionsinceid') ? settings.mentionsinceid : -1;
      var canplaysound = Modernizr.audio && (Modernizr.audio.mp3 || Modernizr.audio.ogg); 
      if (!canplaysound) { //not able to play mp3 or ogg, disable sound notification options
        this.options['alert-sound-message'] = this.options['alert-sound-mention'] = false;
        this.enableoption(['alert-sound-message', 'alert-sound-mention'], false);
      }
      if (settings.version !== this.version) {
        this.showmessage('Tweetfilter has been updated!<br /><a href="http://tweetfilter.org/#whatsnew" target="_blank">See what\'s new</a>', {resident: true});
      }
    } //need to refresh after import
    this.savesettings(imported);
    if (typeof imported !== 'undefined') {
      location.reload(true);
    }
  };

  //save settings in local storage
  Tweetfilter.prototype.savesettings = function(imported) {   
    var settings = this.getvalue(':TWEETFILTER:', {});
    if (typeof imported != 'undefined') {
      settings[this.user.id].version = this.version;
      settings[this.user.id] = imported;
      settings[this.user.id].messagesinceid = this.status.messagesinceid > 0 ? this.status.messagesinceid : -1;
      settings[this.user.id].mentionsinceid = this.status.mentionsinceid > 0 ? this.status.mentionsinceid : -1;
      settings[this.user.id].friendstatus = this.friendstatus;
    } else {
      settings[this.user.id] = {
        queries: [],
        options: this.options,
        version: this.version,
        messagesinceid: this.status.messagesinceid > 0 ? this.status.messagesinceid : -1,
        mentionsinceid: this.status.mentionsinceid > 0 ? this.status.mentionsinceid : -1,
        friendstatus: this.friendstatus
      };
      for (var q in this.queries) {
        settings[this.user.id].queries.push({
          query: this.queries[q].raw,
          enabled: this.queries[q].enabled
        });
      }
    }
                                                                                                    _D('F:savesettings', settings);
    this.setvalue(':TWEETFILTER:', settings);
  };

  //attempts to find dasboard components if one is missing.
  Tweetfilter.prototype.findcomponents = function() {
    var dashboard = twttr.app.currentPage().$node.find(".dashboard");
    var components = $("> div.component:not(.tf):not(:empty)", dashboard);
                                                                                                    _D('F:findcomponents', 'identifying', components.length, 'components');
    for (var i=0,len=components.length,container;i<len && (container=components.eq(i));i++) {
      for (var c=0,clen=this.components.length,component;c<clen && (component=this.components[c]);c++) {
        if ($(component['path'], container).length) {
                                                                                                    _D('F:findcomponents', 'I:found component', component.css, 'option:', component.option);
          if (component.option) this.enableoption(component.option);
          container.addClass('tf '+component.css);
          if (typeof component['callback'] === 'function') {
            component.callback(this, container);
          }
          break;
        }
      }
    }
    return !$('> div.component:not(.tf):not([style])').length; //in poll functions, return true will stop the repoll
  };
  
  Tweetfilter.prototype.addclass = function(classnames) {
    $('body').toggleClass('tf-'+classnames.join(' tf-'), true);
    return true;
  };
  
  Tweetfilter.prototype.removeclass = function(classnames) {
    $('body').removeClass('tf-'+classnames.join(' tf-'));
    return true;
  };

  //enable an option after required components were detected
  Tweetfilter.prototype.enableoption = function(option, enabled) {
    
    if (typeof enabled === 'undefined') enabled = true;
    if (!$.isArray(option)) option = [option];
    for (var i=0,len=option.length,ia;i<len;i++) {
                                                                                                    _D('F:enableoption', 'W:' +(enabled ? 'enable' : 'disable')+' option', option);
      ia = $.inArray(option[i], this.disabledoptions);
      if (ia !== -1 && enabled) {
        this.disabledoptions.splice(ia,1);          
      } else if (ia === -1 && !enabled) {
        this.disabledoptions.push(option[i]);
      }
      if (this.widget) $('[data-option="'+option[i]+'"]', this.widget).closest('li').toggleClass('disabled', !enabled);
                                                                                                    _D('F:enableoption', 'D:currently disabled options:', this.disabledoptions);
                                                                                                    if (this.widget)  _D('F:enableoption', 'D:found options:', $('[data-option="'+option[i]+'"]', this.widget).length, 'setting "disabled" class to', !enabled);
    }
  };
  
  Tweetfilter.prototype.getoption = function(option) {
    return this.options[option] && $.inArray(option, this.disabledoptions) === -1;
  };

  //set an option
  Tweetfilter.prototype.setoption = function(option, status, clicked) {
                                                                                                    _D('F:setoption','setting option', option, 'to', status, 'clicked:', clicked);
    if (typeof clicked !== 'boolean') { //will not refresh styles when not clicked
      clicked = false;
    }
    if (typeof status === 'undefined' || status === null) { //toggle option with null status
      status = !this.options[option];
    }
    if (typeof status !== 'string') {
      status = !!status; //has to be boolean or a string
    }
    var immediaterefresh = false;
    var refresh = []; //which styles to refresh
    
    if (option === 'filter-passed') {
      option = 'filter-inverted'; 
      status = false;
    }
    
    if (this.options.hasOwnProperty(option)) {
      this.options[option] = status; //set option
    } else {
                                                                                                    _D('F:setoption','W:ignoring invalid option', option);
      return false;
    }
    switch(option) {
      /* options changing the stream */
      case 'filter-disabled': /* disable filter */
        this.refreshoptions();
        this.poll('setstreamtitle');
        refresh = ['filter'];
      break;
      case 'filter-inverted': /* show only filtered*/
        if (clicked) {
          if (this.exclusive.length) {
            this.exclusive = [];
            this.refreshfilterlist();
            this.refreshoptions();
          }
          refresh = [];
          this.refreshfiltercss();
          this.setstreamtitle();
          window.scrollTo(0,0); //scroll to top when switching between timeline and filtered
        } else {
          this.poll('setstreamtitle');
          immediaterefresh = this.streamready(); //make switch from/to inverted more fluid
          refresh = ['filter'];
        }
        if (this.widget) this.widget.toggleClass('inverted', status);
      break;
      case 'filter-minimized': /* toggle tweetfilter layout */
        if (this.hasOwnProperty('widget') && typeof this.widget !== 'undefined') {
          this.widget.toggleClass('minimized', status);
        }
      break;
      case 'skip-me': /* filter my posts */
      case 'skip-mentionsme': /* filter tweets mentioning me */
      case 'filter-replies': /* filter all replies */
      case 'filter-links': /* filter all tweets with links */
      case 'filter-retweets': /* filter all retweets */
      case 'filter-media':  /* filter all media */
        refresh = ['filter'];
      break;
      /* options changing the global layout */
      case 'hide-topbar':   /* auto-hide top bar */
      case 'expand-last':   /* show full last tweet */
      case 'compact-activities':  /* compact activities */
      case 'hide-question':     /* hide "what's happening?" */
      case 'hide-tweetbox':     /* hide main tweet box */
      case 'hide-wtf':     /* hide who to follow */
      case 'hide-trends':  /* hide trends */
      case 'minify-menu':  /* hide optional menu items */
      case 'hide-ad':      /* hide ad */
      case 'fixed-dashboard':  /* fixed dashboard */
      case 'show-via': /* show tweet source */
      case 'show-br': /* show line breaks in tweets */
      case 'small-links': /* show small links */
        this.poll((status ? 'add' : 'remove') +'class', [option]);
      break;
      case 'highlight-mentionsme': /* highlight tweets mentioning me */
        refresh = ['filter'];
        this.poll((status ? 'add' : 'remove') +'class', [option]);
      break;
      case 'expand-new': /* expand new tweets */
        if (status) {
          var newtweetsbar = $('div#new-tweets-bar');
          if (newtweetsbar.length) newtweetsbar.trigger('click');
        }
        this.poll((status ? 'add' : 'remove') +'class', [option]);
      break;
      case 'expand-links': /* show expanded links */
        this.poll('parselinks');
      break;
      case 'alert-mention':
      case 'alert-message':
        this.poll('checkreceived');
      break;
      case 'alert-sound-mention':
      case 'alert-sound-message':
        this.poll('checkreceived');
        if (this.status.initialized) {
          this.showmessage((option.indexOf('mention') > -1 ? 'Mention' : 'Message')+' alert '+(status ? 'enabled' : 'disabled')+'.');
          if (status) {
            this.playsound();
          }
        }
      break;
      case 'show-friends':
        this.poll((status ? 'add' : 'remove') +'class', [option]);
        refresh = ['friends'];
        this.poll('refreshfriends', status);
      break;
    }
    if (clicked && !!this.widget) {
      $('[data-option='+option+']', this.widget).closest('li').toggleClass('checked', status);
    }
    if (clicked && this.status.initialized) { //do not refresh during loadsettings or manual calls
      this.savesettings();
      if (refresh.length) {
        if (immediaterefresh) {
          this.refreshcss(refresh);
        }else {
          this.poll('refreshcss', refresh);
        }
      }
    }
    return true;
  };
  
  Tweetfilter.prototype.setstreamtitle = function() {
    //set on widget
    $('#tf-stream-title').html(this.stream.title);
                                                                                                    _D('F:setstreamtitle', 'I:'+this.stream.title);
    var sm;
    if ((sm = twttr.app.currentPage().streamManager)) {
                                                                                                    _D('F:setstreamtitle', 'I:', this.stream.namespace+' ('+this.stream.activetab+')');
     //set in stream
      var textcontainer = $('> h2', sm.$titleContainer);
      if (!textcontainer.length) {
        textcontainer = $('<h2></h2>');
        sm.$titleContainer.prepend(textcontainer);
      } 
      if (textcontainer.is(':empty')) {
        textcontainer.html(this.stream.title);
      } else if ($('span.stream-tab-title-inner', textcontainer).length) {
        textcontainer = $('span.stream-tab-title-inner', textcontainer);
      } else if ($('>span', textcontainer).length) {
        textcontainer = $('>span', textcontainer);
      }
      var exclusivemode = this.exclusive.length > 0;

      if (!this.options['filter-disabled']) {
        $('> em', textcontainer).remove();
        if (exclusivemode || this.options['filter-inverted']) { //viewing "Filtered" tweets
          textcontainer.prepend('<em>Filtered </em>');
        }         
        $('> div.tf', textcontainer).remove();
        if (exclusivemode) {
          var filterlist = [];
          if ($.inArray('replies', this.exclusive) > -1) {
            filterlist.push(['<span class="replies"><b>Replies</b></span>'])
          }
          if ($.inArray('retweets', this.exclusive) > -1) {
            filterlist.push(['<span class="retweets"><b>Retweets</b></span>'])
          }
          if ($.inArray('links', this.exclusive) > -1) {
            filterlist.push(['<span class="links"><b>Tweets with links</b></span>'])
          }
          if ($.inArray('media', this.exclusive) > -1) {
            filterlist.push(['<span class="media"><b>Tweets with media</b></span>'])
          }
          for (var i=0, len=this.queries.length, elen=this.exclusive.length, found=0; i<len && found<elen; i++) {
            if ($.inArray(this.queries[i].id, this.exclusive) > -1) {
              filterlist.push(['<span class="'+this.queries[i].type+'">'+this.queries[i].label+'</span>']);
              found++;
            }
          }
          textcontainer.append('<div class="tf">Filters: '+filterlist.join(', ')+'</div>');
        }
      } else { //filter disabled: simple stream title
        $('> em, > div.tf', textcontainer).remove();
        sm.$titleContainer.html('<h2>'+this.stream.title+'</h2>');
      }
      return this.stream.title !== 'Initializing...';
    }
    return false; 
  };
  
  //process items combining html stream and cache
  Tweetfilter.prototype.parseitems = function() { 
                                                                                                    _D('F:parseitems', arguments);
    var cs, i=0, data, filteredcount, nextid, itemcount, uid, nextuid;
    if (!(cs = this.cs())) return false;
    switch(cs.streamItemType) {
      case 'tweet':
        if (!cs.hasOwnProperty('filter')) {
          cs.filter = { //create filter index in cached stream
            items: [],    //all cleaned, processed items to use with checktweet
            itemids: {},  //twttr-api ids associated with internal ids
            userids: {},  //map usernames to ids
            users: [],    //user index with uid as primary key. for fast user filter (or to list all users in timeline). also contains retweet users.
            tweets:[],    //all tweets (custom ids)
            hidden: [],   //tweets currently marked as hidden (during refreshcss(filter))
            replies: [],  //replies and tweets beginning with @mention
            retweets: [], //retweets in timeline
            media: [],    //tweets containing media
            matches: [],  //tweets matching filter queries, two dimensional index
            excluded: [],  //tweets matching excluded queries, two dimensional index
            links: [],    //tweets containing links (* contains also media, because media is posted along with a link)
            mentionsme: [], //tweets mentioning current user
            me: []         //tweets by current user
          };
        }
                                                                                                  _D('F:parseitems', 'items in cache:', cs.items.length, ' already processed:', cs.filter.items.length);
        if (cs.filter.items.length < cs.items.length) {
          i = 0;
          filteredcount = cs.filter.items.length;
          nextid = cs.filter.items.length;
          itemcount = cs.items.length;
          while (filteredcount < itemcount) {
            if (i < filteredcount) {
              if (cs.filter.itemids.hasOwnProperty(cs.items[i].id)) {
                i = filteredcount;
              }
            }
            data = cs.items[i];
                                                                                                    _D('F:parseitem')
            var tweet = {
              id: nextid++,                                    //small unique id in stream. tweet in stream will get id="tf<id>"
              tweetid: data.id,                                //real (long) item id 
              userid: data.user.idStr,                         //for friend status
              screenname: data.user.screenName,                //for message icon
              name: data.user.attributes.name.toLowerCase(),   //for name filter
              username: data.user.screenName.toLowerCase(),    //for user filter
              via: data.source,                                //to display in tweets (show-via)
              source: data.source.toLowerCase(),               //for source filter
              friend: -1,                                      //friend status: -1=unchecked, 0=no relation, 1=following, 2=follower, 4=mutual
              text: data.text.toLowerCase(),                   //for simple filters (including hashtags, mentions, links)
              isreply: data.isReply,                           //for replies filter
              haslinks: data.entities.urls.length > 0,         //for links filter
              matches: []                                      //found matches to filters. to avoid multiple tweet filtering
           // isme: false,                                     //for excluding own posts (only set if "true")
           // mentionsme: false,                               //for highlighting/excluding mentions (only set if "true")
           // ismedia: false,                                  //for all media filter (set in parsestream, only set if "true")
           // rt: {                                            //retweet info (only set on retweets), for all retweets filter
           //   userid: '',                                    //for friend status, not set on classic retweets
           //   username: '',                                  //for user filter (filter a user also filters his retweets)
           //   via: '',                                       //to display in retweets near OP's-source
           //   source: '',                                    //for source filter (this way the filter can't be tricked by retweets of unwanted bots)
           //   friend: -1                                     //friend status with retweeting user
           // },
           // maybe for future use:
           // imageurl: data.user.attributes.profile_image_url,
           // userwebsite: data.user.url,
            };
            if (data.user.id === this.user.id) {
              tweet.isme = true;
            }
            if (data.isreply) tweet.isreply = true;
            if (tweet.source.indexOf('<') > -1) {
              tweet.source = tweet.source.replace(/<\S[^><]*>/g, ''); //remove any html from source
            }
            if (data.hasOwnProperty('retweetingStatus')) {
              tweet.rt = {
                userid: data.retweetingStatus.user.idStr,
                username: data.retweetingStatus.user.screenName.toLowerCase(),
                via: data.retweetingStatus.source,
                source: data.retweetingStatus.source.toLowerCase()
              };
              if (tweet.rt.source.indexOf('<') > -1) {
                tweet.rt.source = tweet.rt.source.replace(/<\S[^><]*>/g, ''); //remove any html from rt source
              }
            }
            if (data.entities.user_mentions.length) { //tweet contains mentions
              var mention, mentioned;
              for (var m=0, mlen=data.entities.user_mentions.length; m<mlen; m++) {
                mention = data.entities.user_mentions[m];
                mentioned = mention.screen_name.toLowerCase();
                if (mentioned === this.user.name) {
                  tweet.mentionsme = true;
                                                                                                  // _D('F:parseitems','L:found mention of ', this.user.name);
                }
                if (mention.indices[0] === 0) {
                  tweet.isreply = true; //start of a discussion may not be a reply to a specific tweet, but is still a reply for user's eye, so for the filter
                } else if (!tweet.rt && mention.indices[0] === 3 && tweet.text.indexOf('rt ')===0) { //possible classic retweet/quote/mention: RT @username
                  tweet.rt = {username: mentioned};
                }
                                                                                                  // _D('F:parseitems','L:mention found: @', mentioned, 'at', mention.indices);
              }
            }
            tweet.text = this.decodehtml($.trim(tweet.text));
            if (data.hasOwnProperty('expandedurls')) {
                                                                                                    _D('F:parseitems','W:found expandedurls in tweet data!');
              tweet.text += data.expandedurls;
              delete data['expandedurls'];
            }
            //feed filter index
            cs.filter.items.push(tweet);
            if (cs.filter.users.hasOwnProperty(tweet.username)) {
              cs.filter.users[tweet.username].push(tweet.id);
            } else {
              cs.filter.users[tweet.username] = [tweet.id];
              cs.filter.userids[tweet.username] = tweet.userid;
            }
            if (tweet.rt) {
              if (cs.filter.users.hasOwnProperty(tweet.rt.username)) {
                cs.filter.users[tweet.rt.username].push(tweet.id);
              } else {
                cs.filter.users[tweet.rt.username] = [tweet.id];
              }
              if (tweet.rt.userid && !cs.filter.userids.hasOwnProperty(tweet.rt.username)) {
                cs.filter.userids[tweet.rt.username] = tweet.rt.userid;
              }
            }
            cs.filter.tweets.push(tweet.id);
            if (tweet.isreply) cs.filter.replies.push(tweet.id);
            if (tweet.rt) cs.filter.retweets.push(tweet.id);
            if (tweet.haslinks) cs.filter.links.push(tweet.id);
            if (tweet.isme) cs.filter.me.push(tweet.id);
            if (tweet.mentionsme && this.stream.namespace !== 'Mentions') cs.filter.mentionsme.push(tweet.id);
            cs.filter.itemids[tweet.tweetid] = tweet.id;            
            this.checktweet(tweet);
            filteredcount++;
            i++;
          }
                                                                                                    _D('F:parseitems','I:items parsed!');
        }
        this.poll('parsestream');    //always trigger parsestream, new items are already cached before they are displayed 
        break;
      case 'user':
        if (!cs.hasOwnProperty('filter')) {
          cs.filter = { //create filter index in cached stream
            items: [],    //all cleaned, processed items to use with checktweet
            itemids: {},  //twttr-api ids associated with internal ids
            users: {}    //timeline index with user as primary key. for fast user filter (or to list all users in timeline) 
          };
        }
                                                                                                    _D('F:parseitems', 'items in cache:', cs.items.length, ' already processed:', cs.filter.items.length);
        if (cs.filter.items.length < cs.items.length) {
          i = 0;
                                                                                                    _D('F:parseitems', 'parsing from',cs.filter.items.length,'to',cs.items.length-1);
          filteredcount = cs.filter.items.length;
          nextid = cs.filter.items.length;
          itemcount = cs.items.length;
          while (filteredcount < itemcount) {
            if (i < filteredcount) {
              if (cs.filter.itemids.hasOwnProperty(cs.items[i].id)) {
                i = filteredcount;
              }
            }          
            data = cs.items[i];
            var user = {
              id: nextid++, //unique id. tweet in stream will get id="t<id>"
              userid: data.idStr,
              screenname: data.screenName,
              name: data.screenName.toLowerCase()
            };
            //feed filter index
            cs.filter.items.push(user);
            cs.filter.users[user.name] = user;
            cs.filter.itemids[user.userid] = user.id;            
            filteredcount++;
            i++;
          }
                                                                                                    _D('F:parseitems','I:items parsed!');
        }
        this.poll('parsestream');    //always trigger parsestream, new items are already cached before they are displayed 
        break;
    }
    return true;
  }; //parseitems()
  
  Tweetfilter.prototype.cs = function() {
    try {
      var cs = twttr.app.currentPage().streamManager.getCurrent();
      if (cs.items) {
        return cs;
      }
      this.stream.status = 'notloaded';
      return false;
    } catch(e) {
      this.stream.status = 'notloaded';
      return false;
    }
  };
  
  //main function picking up items from html stream and performing DOM-Operations on tweets
  Tweetfilter.prototype.parsestream = function() {
    if (this.options['expand-new'] && $('#new-tweets-bar').length) {
      $('#new-tweets-bar').trigger('click');
      return true;
    }
    var cs = this.cs();
    if (this.stream.itemtype !== 'tweet' && this.stream.itemtype !== 'user') {
      return true; //stop polling this function, not a tweet/user stream
    }
    if (!cs.hasOwnProperty('filter')) { //first parse items in cache!
      this.poll('parseitems');
      return true;
    }
                                                                                                    _D('F:parsestream', 'fired', cs.$node, this.stream);
    var items = $('> div.stream-items > div.stream-item:not([id])', cs.$node);                      //parse stream only once, distribute ids
    if (items.length) {
      var item, itemid, id, i, imax, tweet, user, li, reparseitems = false;
      switch(cs.streamItemType) {
        case 'tweet':
          for (i=0, imax=items.length, item; i<imax && (item=items.eq(i)); i++) {
            itemid = item.attr('data-item-id');
            if (cs.filter.itemids.hasOwnProperty(itemid)) {
              id = cs.filter.itemids[itemid];
              tweet = cs.filter.items[id];
              $('> div.stream-item-content', item.attr('id', 't'+id)).attr('id', 'i'+id);
              var tweettext = $('div.tweet-text', item);
              var htmltext = tweettext.html();
              if (htmltext.indexOf("\n") > -1) {
                tweettext.html(htmltext.replace(/\n/g, ' <br />')); //insert line breaks
              }
              tweet.ismedia = $("span.icons span.media", item).length > 0; //TODO:refine media filter - photos, video, links
              if (tweet.ismedia) {
                li = $.inArray(tweet.id, cs.filter.links);
                if (li > -1) {
                  tweet.haslinks = false; //treat media separately as if it had no links
                  cs.filter.links.splice(li, 1);
                }
                cs.filter.media.push(tweet.id);
              }
              $('span.tweet-full-name', item).after('<i class="tfu u'+tweet.userid+'"></i>');
              if (tweet.rt && tweet.rt.userid) {
                $('span.retweet-icon', item).next('em').after('<i class="tfu u'+tweet.rt.userid+'"></i><span class="tf-via">via '+tweet.rt.via+'</span>');
              }
              $('span.tweet-actions', item)
                .append('<a class="tf dm" data-user="'+tweet.screenname+'" title="Direct message"><span><i class="tf-icon"></i> <b>DM</b></span></a>'+
                        '<a class="tf quote" data-itemid="'+tweet.id+'" title="Quoted Retweet"><span><i class="tf-icon"></i> <b>Quote</b></span></a>'+
                        '<a class="tf menu" data-itemid="'+tweet.id+'" title="Tweetfilter"><span><i class="tf-icon"></i> <b>Filter</b></span></a>')
                .before('<span class="tf-via">via '+tweet.via+'</span>');
                                                                                                    _D('F:parsestream', 'I:itemid', itemid, 'found, id:',id);
            } else {
                                                                                                    _D('F:parsestream', 'W:itemid not found in filtered:',itemid);
              reparseitems = true;                                                                                      
            }
          }
          break;
        case 'user':
          for (i=0, imax=items.length, item; i<imax && (item=items.eq(i)); i++) {
            itemid = item.attr('data-item-id');
            if (cs.filter.itemids.hasOwnProperty(itemid)) {
              id = cs.filter.itemids[itemid];
              user = cs.filter.items[id];
              $('> div.stream-item-content', item.attr('id', 't'+id)).attr('id', 'i'+id);
              $('span.full-name', item).after('<i class="tfu u'+user.userid+'"></i>');
                                                                                                     _D('F:parsestream', 'I:itemid', itemid, 'found, id:',id);
            } else {
              reparseitems = true;
                                                                                                    _D('F:parsestream', 'W:itemid not found in filtered:',itemid);
            }
          }
          break;
      }
      if (reparseitems) { //some items were not parsed, trigger a reparse
        this.poll('parseitems');
      }
      this.refreshfiltercss();
      this.poll('parselinks');      
    }
    return true;
  };
  
  Tweetfilter.prototype.findexactmatch = function(haystack, needle) { //find exact match without using regex
    var pos = haystack.indexOf(needle), ismatch=false, hlen=haystack.length, nlen=needle.length;
    while (pos > -1) {
      ismatch = (pos === 0 || this.stopchars.indexOf(haystack.charAt(pos-1)) > -1) && //if it's at the beginning or preceded by a stopchar
                (pos+hlen === hlen || this.stopchars.indexOf(haystack.charAt(pos+nlen)) > -1); //and at the end or followed by a stopchar
      if (ismatch) {
        break;
      }
      pos = haystack.indexOf(needle, pos+1);
    }
    return ismatch;
  };
  
  //check tweet for any match or a specific search object 
  Tweetfilter.prototype.checktweet = function(tweet, search) {
                                                                                                    var f=_F('checktweet');
     var cs = this.cs(), query, ismatch;
     if (cs && this.streamready()) {
      var searches = [];
      if (typeof search !== 'undefined') {
        searches = [search];
      } else {
        tweet.matches = [];
        searches = this.queries;
      }
                                                                                                    _D(f, 'checking tweet', tweet, 'searches', searches);
      for (var s=0, smax=searches.length; s < smax; s++) {
        query=searches[s];
        ismatch = false;
        //simple text filter: regular, exact and simple match (=contains keyword) allowed
        if (query.simple) {
          if (query.regular) {
            ismatch = query.regex.test(tweet.text);
                                                                                                    _D(f, 'check for regular match:', query.rx, 'in', tweet.text, ':', ismatch)
          } else 
          if (query.exact) {
            ismatch = this.findexactmatch(tweet.text, query.search);
                                                                                                    _D(f, 'check for exact match:', query.search, 'in', tweet.text, ':', ismatch)
          } else {
            ismatch = tweet.text.indexOf(query.search) > -1;
                                                                                                    _D(f, 'check for simple match:', query.search, 'in', tweet.text, ':', ismatch)
          }
        } else 
        //user filter: regular and simple (lowercase) match allowed
        if (query.user) {
          if (query.regular) {
            ismatch = query.regex.test(tweet.username) || (tweet.rt && query.regex.test(tweet.rt.username))
                                                                                                    _D(f, 'check for regular user match:', query.rx, 'in', tweet.username, ':', ismatch)
          } else {
            ismatch = (tweet.username === query.search) || (tweet.rt && tweet.rt.username === query.search);
                                                                                                    _D(f, 'check for user match:', query.search, '==', tweet.username, tweet.rt ? tweet.rt.username : '', ':', ismatch)
          }
        } else 
        //source filter: regular, exact and simple match (=contains keyword) allowed
        if (query.source) {
          if (query.regular) {
            ismatch = query.regex.test(tweet.source) || (tweet.rt && tweet.rt.source && query.regex.test(tweet.rt.source)); //checking source of OP and RT-user
                                                                                                    _D(f, 'check for regular source match:', query.rx, 'in', tweet.source, tweet.rt ? tweet.rt.source : '', ':', ismatch)
          } else 
          if (query.exact) {
            ismatch = this.findexactmatch(tweet.source, query.search) || (tweet.rt && tweet.rt.source && this.findexactmatch(tweet.rt.source, query.search));
                                                                                                    _D(f, 'check for exact source match:', query.search, 'in', tweet.source, tweet.rt ? tweet.rt.source : '', ':', ismatch)
          }else {
            ismatch = tweet.source.indexOf(query.search) > -1 || (tweet.rt && tweet.rt.source && tweet.rt.source.indexOf(query.search) > -1);
                                                                                                    _D(f, 'check for source match:', query.search, 'in', tweet.source, tweet.rt ? tweet.rt.source : '', ':', ismatch)
          }
        } else 
        //name filter: regular, exact and simple match (=contains keyword) allowed
        if (query.name) {
          if (query.regular) {
            ismatch = query.regex.test(tweet.name); //do not filter here the retweeting user's real name. it's visible nowhere, would be irritating
                                                                                                    _D(f, 'check for regular name match:', query.rx, 'in', tweet.name, ':', ismatch)
          } else 
          if (query.exact) {
            ismatch = this.findexactmatch(tweet.name, query.search);
                                                                                                    _D(f, 'check for exact name match:', query.search, '=', tweet.name, ':', ismatch)
          } else {
            ismatch = tweet.name.toString().indexOf(query.search) !== -1;
                                                                                                    _D(f, 'check for simple name match:', query.search, 'in', tweet.name, ':', tweet.name.indexOf(query.search), ismatch)
          }
        }
        if (ismatch && $.inArray(query.id, tweet.matches) === -1) {
          if (!cs.filter.matches.hasOwnProperty(query.index)) {
            cs.filter.matches[query.index] = [tweet.id];
          } else if ($.inArray(tweet.id, cs.filter.matches[query.index]) === -1) {
            cs.filter.matches[query.index].push(tweet.id);
          }
                                                                                                    _D(f, 'I:pushing match', query.id, '=', query.index, 'on tweet', tweet.id);
          tweet.matches.push(query.id);
        }        
      }
    } else _D(f, 'W:stream is not ready!');
  };
  
  Tweetfilter.prototype.refreshfiltercss = function(instantly) {
    if (typeof instantly === 'undefined') instantly = false;
                                                                                                    _D('F:refreshfiltercss', 'refreshing filter css');
    if (!instantly) {
      this.poll('refreshcss', ['filter']);
    } else {
      this.refreshcss(['filter']);
    }
  };
  
  Tweetfilter.prototype.addquery = function(query, enabled) {
    if (this.status.settingsloaded && this.options['filter-disabled']) {
      return false;
    }
    if (typeof enabled != 'boolean') {
      enabled = true;
    }
    var search = {
      id: this.nextid++,            //unique id
      index: query.toLowerCase(),   //lowercase query
      raw: query,                   //raw, case-sensitive query. <-- saved in localStorage
      search: query.toLowerCase(),  //what to (really) search for
      label: query,                  //label shown in ui, case sensitive
      sortby: query,                //value used for sorting
      type: '',
      count: 0,                     //match count in current stream
      enabled: enabled,             //status <-- saved in localStorage
      excluded: query.indexOf('-') === 0              //exclude the query from filter
    }
    var types = {
      user:    /^\-?(?:f(?:rom)?\:\s*@?|@@)([A-Za-z0-9\_]{1,15}|(?:.+\=)?\/.+\/)$/, // from: @tweetfilterjs or from:tweetfilterjs or f:tweetfilterjs or @@tweetfilterjs (short syntax)
      source:  /^\-?(?:v(?:ia)?\:\s*|\:@)(.+)$/, // via: echophon or via:web or v:iphone or :@sometwitterbot (short syntax)
      name:    /^\-?(?:by?\:\s*|\?@)(.+)$/, // name: john doe or n:jane or ?@john  (short syntax)
      exact:   /^\-?"(.+)"$/, //case-insensitive exact phrase surrounded by stopchars like space or period
      simple:  /^'?\-?(.+)/ //anything else is simple text search or regex (within text and within expanded links text), trim leading escape character (single quote)
    }
    var matches, regularmatch, exactmatch;
    for (var type in types) {
      matches = search.raw.match(types[type]);
      if (matches) {
        regularmatch = exactmatch = false; //extended syntax, e.g. via:/^(iphone|android)$/  or name:"Joanna" or @/^bot
        search.label = matches[1]; //preserve case for labels and regular expressions
        search.search = search.sortby = matches[1].toLowerCase(); //always do case insensitive search / sort
        search.type = type;
        //normalize all inputs with different syntaxes
        switch(type) {
          case 'exact':
            search.label = search.raw = '"'+search.label+'"';
            search.index = search.raw.toLowerCase();
            search.exact = true;
          break;
          case 'simple':
            search.simple = true;
            search.raw = search.label;
            search.index = search.raw.toLowerCase();
            if ((regularmatch = search.label.match(/^(?:(.+)\=)?\/(.+)\/$/))) { //regular text match <-- /(something|matching)/
              search.label = (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : '/'+regularmatch[2]+'/im');
              search.search = search.rx = regularmatch[2];
              search.sortby = (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : regularmatch[2]);
            }              
          break;
          case 'user': //match tweets by user
            search.user = true;
            search.index = 'from:@'+search.search;
            search.raw = 'from:@'+search.label;
            if (/^[A-Za-z0-9\_]{1,15}$/.test(search.label)) {
              search.label = '@'+search.label;
            } else if ((regularmatch = search.label.match(/^(?:(.+)\=)?\/(.+)\/$/))) {
              search.label = '@'+(typeof regularmatch[1] != 'undefined' ? regularmatch[1] : '/'+regularmatch[2]+'/i');
              search.search = search.rx = regularmatch[2];
              search.sortby = (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : regularmatch[2]);
            }
          break;
          case 'source': //match tweets by source (via)
            search.source = true;
            search.index = 'via:'+search.search;
            search.raw = 'via:'+search.label;
            if ((exactmatch = search.search.match(/^"(.+)"$/))) { //exact (=full word) name match <-- by:"John Doe"
              search.label = 'via '+exactmatch[1];
              search.exact = true;
            } else if ((regularmatch = search.label.match(/^(?:(.+)\=)?\/(.+)\/$/))) {
              search.label = 'via '+ (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : '/'+regularmatch[2]+'/i');
              search.search = search.rx = regularmatch[2];
              search.sortby = (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : regularmatch[2]);
            } else {
              search.label = 'via '+search.label;
            }
          break;
          case 'name': //match tweets by (real?)name of user
            search.name = true;
            search.index = 'by:'+search.search;
            search.raw = 'by:'+search.label;
            if ((exactmatch = search.search.match(/^"(.+)"$/))) { //exact (=full word) name match <-- by:"John Doe"
              search.label = 'by '+exactmatch[1];
              search.exact = true;
            } else if ((regularmatch = search.label.match(/^(?:(.+)\=)?\/(.+)\/$/))) { //regular name match <-- by:The Doe's=/(jane|john)\sdoe/
              search.label = 'by '+ (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : '/'+regularmatch[2]+'/i');
              search.search = search.rx = regularmatch[2];
              search.sortby = (typeof regularmatch[1] != 'undefined' ? regularmatch[1] : regularmatch[2]);
            } else {
              search.label = 'by '+search.label;
            }
          break;
        }
        if (search.rx) { 
          try {
            search.regex = new RegExp(search.rx, 'im'); //case insensitive, multiline
            search.regular = true;
          } catch(e) {
            this.showmessage('This regular expression is invalid.<br />If you did not intend to use regular<br /> expressions prefix your filter with \' (single quote).');
            return false;
          }
        }
        if (search.excluded) {
          search.index = '-'+search.index;
          search.raw = '-'+search.raw;
        }
        break;
      }
    }
    for (var i=0, q; q=this.queries[i]; i++) {
      if (q.index === search.index) {
        return q.id; //already in filters/excludes: return query index
      }
    }
    this.queries.push(search);
    this.queries.sort(function(a, b) { //sort the filter list
      return ((a.sortby < b.sortby) ? -1 : ((a.sortby > b.sortby) ? 1 : 0));
    });
    if (this.status.initialized) {
      this.savesettings();
      var cs = this.cs();
      if (this.streamready()) {
        if (cs.hasOwnProperty('filter')) {
          cs.filter.matches[search.index] = [];
          for (var t in cs.filter.items) {
            this.checktweet(cs.filter.items[t], search);
          }
          if (enabled && cs.filter.matches[search.index].length) {
            this.refreshfiltercss();
          }
        }
      }
      this.poll('refreshfilterlist');
    }
    return search.id;
  };

  Tweetfilter.prototype.setquerystatus = function(queryid, status) { //status: true/false: toggle, -1: delete, -2: toggle exclusive filter
    if (this.options['filter-disabled']) {
      return;
    }
    var exclusivemode = this.exclusive.length > 0, q;
                                                                                                    _D('F:setquerystatus', 'set query', queryid, 'to status', status);
    for (var i=0,len=this.queries.length;i<len;i++) {
      if (this.queries[i].id === +queryid) {
        switch(status) {
          case -1: //delete from filter
                                                                                                    _D('F:setquerystatus', 'query', this.queries[i].id, 'at index', $.inArray(this.queries[i].id, this.exclusive));
            if (exclusivemode && $.inArray(this.queries[i].id, this.exclusive) > -1) { //deleting an exclusive filter
              this.setexclusive(this.queries[i].id); //remove from exclusive
            }
            this.queries.splice(i, 1);
            this.savesettings();
            this.refreshfilterlist();
            this.refreshfiltercss();
            this.setstreamtitle();
            break;
          case -2: //set as exclusive filter
            this.setexclusive(this.queries[i].id);
            this.poll('setstreamtitle');
            this.refreshfiltercss();
            break;
          default: //enable or disable query temporarily
            if (this.queries[i].enabled != status) {
              this.queries[i].enabled = status;
              this.savesettings();
              this.poll('refreshfilterlist');
              this.refreshfiltercss();
            }
            break;
        }
        break;
      }
    }
  };
  
  Tweetfilter.prototype.showmessage = function(message, options) {
    if (typeof options === 'undefined') {
      options = {resident: false, timeout: 3000};
    } else if (options === true) {
      options = {resident: true};
    } 
    if (!options.resident && !options.timeout) {
      options.timeout = 3000;
    }
    message =  '<span'+(options.type ? ' class="'+options.type+'"' : '')+'>'+message+'</span>';
    var md = $('#message-drawer');
    var msg = md.html(), $message;
    if (!msg.length) {
      msg = '<div class="message message"><div class="message-inside">'+message;
      if (options.resident) {
        msg += '<a href="#" class="dismiss">×</a>';
      }
      msg += '</div></div>';
      $message = $(msg);
      md.append($message);
      if (!options.resident) {
        setTimeout(function() {
          $message.css("opacity", 1).animate({
           opacity: 0
          }, 1000, function () {
           $message.remove();
          });
        }, options.timeout);
      }
    } else { //there was already a message open
      $message = $(msg);
      if (options.type) {
        var container = $('span.'+options.type, $message)
                                                                                                    _D('F:showmessage', 'I:show message of type', options.type);
        if (container.length) {
          var oldcount = 0; 
          if (options.count) {
            if ((oldcount = container.html().match(/[0-9]+/))) {
                                                                                                    _D('F:showmessage', 'I:found old count of type', options.type, ':', oldcount, 'new count:', +oldcount[1]+options.count);
              oldcount = +oldcount[1]+options.count;
              message.replace(/[0-9]+/, oldcount);
            }
                                                                                                    _D('F:showmessage', 'I:found options.count', options.count, 'old count:', +container.attr('data-count'), 'new count:', oldcount);
          } 
                                                                                                    _D('F:showmessage', 'I:replacing message', message);
          $('span.'+options.type, $message).replaceWith(message);
        } else {
                                                                                                    _D('F:showmessage', 'I:appending message', message);
          $('span:last', $message).after(message);
        }       
      } else {
                                                                                                    _D('F:showmessage', 'I:appending message', message);
        $('span:last', $message).after(message);
      }
    }
  };

  Tweetfilter.prototype.checkreceived = function() {
    if (this.options['alert-message'] || this.options['alert-sound-message'] || this.options['alert-mention'] || this.options['alert-sound-mention']) {
      var that = this;
      if (this.options['alert-message'] || this.options['alert-sound-message']) {
        twttr.currentUser.receivedMessages({
          since_id: this.status.messagesinceid ? this.status.messagesinceid : -1,
          success: function(data, result) {
            if (result.response.length) {
              if (that.status.messagesinceid <= 0) {
                that.status.messagesinceid = result.response[0].id;
                                                                                                    _D('F:checkreceived', 'sinceid:'+that.status.messagesinceid);
                return;
              }
              that.status.messagesinceid = result.response[0].id;
              var howmany = result.response.length;
              if (that.options['alert-message']) that.showmessage('You have '+howmany+' new <a href="#!/mentions">message'+(howmany > 1 ? 's' : '')+'</a>!', {resident: true, type: 'newmessages', count: howmany});
              if (that.options['alert-sound-message']) that.playsound();
              that.savesettings();
            } else if (that.status.messagesinceid === -1) { //user has 0 messages received
              that.status.messagesinceid = 0;
            }
          }
        });
      }
      if (this.options['alert-mention'] || this.options['alert-sound-mention']) {
        twttr.currentUser.mentions({
          since_id: this.status.mentionsinceid ? this.status.mentionsinceid : -1,
          success: function(data, result) {
            if (result.response.length) {
              if (that.status.mentionsinceid <= 0) { 
                that.status.mentionsinceid = result.response[0].id;
                                                                                                    _D('F:checkreceived', 'W:first fetch, not alerting.', 'new sinceid:'+that.status.mentionsinceid);
                return;
              }
              that.status.mentionsinceid = result.response[0].id;
              var howmany = result.response.length;
              if (that.options['alert-mention']) that.showmessage('You have '+howmany+' new <a href="#!/mentions">mention'+(howmany > 1 ? 's' : '')+'</a>!', {resident: true, type: 'newmentions', count: howmany});
              if (that.options['alert-sound-mention']) that.playsound();
              that.savesettings();
            } else if (that.status.mentionsinceid === -1) { //user has 0 messages received
              that.status.mentionsinceid = 0;
            }
          }
        });
      }
      if (!this.timeids.checkreceived || this.timeids.checkreceived === -1) {
        this.timeids.checkreceived = window.setInterval(twttr.bind(this, function(e) {
          this.poll('checkreceived');
        }), 60000);
      }
    } else {
      if (this.timeids.checkreceived !== -1) {
        window.clearInterval(this.timeids.checkreceived);
        this.timeids.checkreceived = -1;
      }
    }
    return true;
  };


  Tweetfilter.prototype.playsound = function() {
    if (Modernizr.audio) {
      if (!document.getElementById('tweetfilter-notify')) {
        var sound;
        if (Modernizr.audio.ogg) {
          sound = new Audio("data:audio/ogg;base64,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");
        } else if (Modernizr.audio.mp3) {
          sound = new Audio("data:audio/mpeg;base64,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IHgBQZmAlqQUChJXU5VuIuSzlrruw7TdqymMxmW0p0FQVDX5YO1iIGrH/////////9P3a9GhOioJAf///////6vfq//t+nNJ//MYxB8DkAWcAgAAAC3H//////7f///33dCbtlCQP/////////MYxCcEOAGcDAAAAP/7km997Sff9VUOP///////8VV6/7r3//MYxC0DuAGgAgAAAvEn41X/R6/bu9XRxl3/7P////1+n0qH//MYxDUECAWcBAAAAE/////+R///+9Who+vH//////////1V//MYxDsEEAGgCgAAAllttOxFNUf+//////8t/f/6uv521y0M//MYxEEEaAWUAAAAAD////////R9jErqb6FK4D/////////8//MYxEYDgAGYAgAAAIxYuogZf2u9FQyB/////////p0LuRyc//MYxE8D2AWgAgAAAqnv9KoOP////////pp/r2Wd7eyzRRY///MYxFYD8AWYAgAAAP///3Wf+5mpjPd/9n7kUACwD/////////MYxF0DmAGgCgAAAv9utm6/rGIVh//////////o3VJn+63///MYxGUEWAWkBAAAAP///o/6P///b//8jeA/////////+vo6//MYxGoESAWcDAAAAPpVD////////9Vmj////+7+pQw///////MYxG8EKAWgCgAAAv//9Pby3eqZ6cf/////////rKUbTtrE//MYxHUEOAWYCgAAAGQ10A4///////o/2XP/9FbvZWqqCQH///MYxHsD+AGkFAAAAP//9n///1ZWz/9orWdrXnRtoD////////MYxIICqAGgAgAAAv////X/+VFFTEFNRTMuOTguNFVVVVVV//MYxI4D6AWUAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxJUDEAWoBAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxJ8D4AGYCAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxKYDgAWcCgAAAlVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxK8EOAGcAgAAAlVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxLUEMAGcCgAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxLsE6AGUDAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxL4DYAVgBAAAAlVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
        } else return;
        sound.id = 'tweetfilter-notify';
        sound.controls = false;
        sound.loop = false;
        sound.autoplay = false;
        sound.setAttribute('style', 'position:absolute; left:-1000px; top:-100px;')
        document.body.appendChild(sound);
      }
      document.getElementById('tweetfilter-notify').play();
    }
  };


  Tweetfilter.prototype.tweetclickvia = function(e) {
                                                                                                    _D('F:tweetclickvia', 'opening link in new tab');
    window.open(e.target.getAttribute('href'));
    return false;
  };

  Tweetfilter.prototype.getselection = function() {
    var selection = window.getSelection();
    return selection ? selection.toString().replace(/<\S[^><]*>/g, '').replace(/\r?\n+/g, ' ') : false;
  };
  
  Tweetfilter.prototype.removeselection = function() { 
    window.getSelection().removeAllRanges(); 
    return true;
  };
  
  Tweetfilter.prototype.tweettextmouseup = function(e) {
                                                                                                    var f=_F('tweettextmouseup');
                                                                                                     _D(f, e);
    if (this.options['add-selection'] && !this.options['filter-disabled'] && $(e.target).closest('div.stream-item').length) {
      if (window.getSelection().toString().length) {
                                                                                                     _D(f, 'I:found selection!');
        e.stopImmediatePropagation();
        return false;
      } else _D(f, 'W:no selection');
    }
    return true;
  };
  
  Tweetfilter.prototype.tweettextmousedown = function(e) {
                                                                                                    var f=_F('tweettextmousedown');
                                                                                                    _D(f, e);
    if (e.which <3) {
      if (this.options['add-selection'] && !this.options['filter-disabled'] && $(e.target).closest('div.stream-item').length) {
        var selected;
        if ((selected = this.getselection())) {
                                                                                                    _D(f, 'adding new query', ((e.which === 2 || e.shiftKey) ? '-' : '') + selected);
          var queryid = this.addquery((e.which === 2 || e.shiftKey ? "-'" : "'") + selected, true, (e.which === 2 || e.shiftKey));
          if (queryid && e.ctrlKey) {
            this.setexclusive(queryid);
            this.poll('refreshfilterlist');            
            this.poll('setstreamtitle');
            this.refreshfiltercss();
          }                   
          this.poll('removeselection');
          e.stopImmediatePropagation();
          return false;
        } else _D(f, 'W:no selection');
      }
    }
    return true;
  };

  Tweetfilter.prototype.filtermenuleave = function(e) {
                                                                                                    _D('F:filtermenuleave');
    var target = $(e.target).is('ul.tf-menu') ? $(e.target) : $(e.target).parents('ul.tf-menu');
    if (target.length) target.remove();
  };

  Tweetfilter.prototype.tweetactionsclick = function(e) {
    switch(e.type) {
      case 'mousedown':
        if (e.which !== 1) return true; 
        //e.stopImmediatePropagation();
        break;
      case 'click':
        var streamitem = $(e.target).closest('div.stream-item');
        var itemid = streamitem.attr('data-item-id');
        if (itemid) {
          var cs = this.cs();
          if (cs.filter.itemids.hasOwnProperty(itemid)) {
            var item = cs.filter.items[cs.filter.itemids[itemid]];
                                                                                                    _D('F:filter_actions_mousedown', 'item found', item);
          } else {
                                                                                                    _D('F:filter_actions_mousedown', 'W:item', itemid, 'not found in cache!');
            return false;
          }

          switch(e.currentTarget.className.substr(3)) {
            case 'dm':
              twttr.API.User.find(item.screenname, function(user) {
                var imageurl = user.profileImageUrl;
                twttr.currentUser.relationshipWith(item.screenname, function(relation) {
                  if (relation.canDM) {
                    if (!relation.following) {
                      twttr.showMessage('You do not follow @'+item.screenname+',<br /> the user will not be able to answer directly.');
                    }
                    twttr.dialogs.dmSingle({
                      user: {
                        screenName: item.screenname,
                        user_id: item.userid,
                        name: item.name,
                        profile_image_url: imageurl
                      },
                      origin: "Tweetfilter "+this.version
                    }).open();
                  } else {
                    if (!relation.followedBy) {
                      twttr.showMessage('@'+item.screenname+' does not follow you.');
                    } else { //fallback
                      twttr.showMessage('You can\'t send direct messages to @'+item.screenname);
                    }
                  }
                });
              });
              break;
            case 'quote':
              var tweettext = false;
              for (var i=0,imax=cs.items.length;i<imax;i++) {
                if (cs.items[i].id === itemid) {
                  tweettext = this.decodehtml(cs.items[i].text);
                  break;
                }
              }
              if (tweettext) {
                new twttr.widget.TweetDialog({
                  modal: false,
                  draggable: true,
                  defaultContent: "RT @"+item.screenname+": "+tweettext,
                  template: {
                    title: _("Retweet "+item.screenname)
                  },
                  origin: "Tweetfilter "+this.version
                }).open().focus();        
              } else _D('F:filter_actions_mousedown', 'W:item', itemid, 'not found in items cache!');

              break;
            case 'menu':
              $('ul.tf-menu', cs.$node).remove();
                                                                                                    _D('filter_menu_mousedown');
              $(e.target).parents('span.tweet-actions').prepend(this.tweetfiltergetmenu(streamitem, cs.filter.itemids[itemid]));
              e.stopImmediatePropagation();
              break;
            case 'add':
                                                                                                    _D('F:filter_actions_mousedown', 'add to filter', e.target);
              if (e.which <3) {
                var queryid = this.addquery((e.which === 2 || e.shiftKey ? '-' : '') + e.target.getAttribute('data-query'), true, e.which === 2 || e.ctrlKey );
                if (queryid && e.ctrlKey) {
                  this.setexclusive(queryid);
                  this.poll('refreshfilterlist');            
                  this.poll('setstreamtitle');
                  this.poll('removeselection');
                  this.refreshfiltercss();
                }
                $('ul.tf-menu').remove();
                e.stopImmediatePropagation();
                var tab = $('a[data-tab='+(e.shiftKey ? 'excludes' : 'filters')+']', this.widget);
                if (!tab.closest('li').hasClass('active')) {
                  tab.trigger('click');
                }
                return false;
              }
              return true;
              break;
          }
        }
        break;
    }
    return false;
  };

  Tweetfilter.prototype.tweetfiltergetmenu = function(item, id) {
                                                                                                    _D('F:tweetfiltergetmenu', item, id);
    var menu = '<ul class="tf-menu drop-down">';
    var username = $('a.tweet-screen-name', item).html();
    menu += '<li class="user"><a class="tf add" data-query="@@'+username+'" title="filter tweets from @'+username+'">@'+username+'</a></li>';
    var retweetuser = $('span.retweet-icon', item).next('em').html();
    if (retweetuser) {
      retweetuser = retweetuser.split(' ')[1];
      menu += '<li class="user"><a class="tf add" data-query="@@'+retweetuser+'" title="filter tweets from @'+retweetuser+'">@'+retweetuser+'</a></li>';
    }
    var sources = [];
    $('span.tf-via', item).each(function() {
      var source = $(this).html().substr(4);
      if (source) {
        source = source.replace(/<\S[^><]*>/g, '');
        if ($.inArray(source, sources) === -1) {
          menu += '<li class="source"><a class="tf add" data-query="via:'+source+'" title="filter tweets via '+source+'">via '+source+'</a></li>';
          sources.push(source);
        }
      }
    })
    var mentions = [];
    var hashtags = [];
    var domains = [];
    var linksmenu = '';
    var hashtagsmenu = '';
    var mentionsmenu = '';
    var links = $('div.tweet-text > a[class]', item);
    if (links.length) {
      for (var l=0, lmax=links.length, link; l<lmax && (link=links.eq(l)); l++) {
        var linkclass = link.attr('class').replace(/^\s+/,'');
        if (linkclass.indexOf(' ') > -1) linkclass = linkclass.split(' ')[0];
        switch(linkclass) {
          case 'twitter-hashtag':
            var hashtag = link.text();
            if (hashtag && $.inArray(hashtag.toLowerCase(), hashtags) === -1) {
              hashtagsmenu += '<li class="hashtag"><a class="tf add" data-query="'+hashtag+'" title="filter tweets tagged '+hashtag+'">'+hashtag+'</a></li>';
              hashtags.push(hashtag.toLowerCase());
            }
            break;
          case 'twitter-atreply':
            var mention = link.attr('data-screen-name');
            if (mention && $.inArray(mention, mentions) === -1) {
              mentionsmenu += '<li class="mention"><a class="tf add" data-query="@'+mention+'" title="filter tweets mentioning @'+mention+'">@'+mention+'</a></li>';
              mentions.push(mention);
            }
            break;
          case 'twitter-timeline-link':
            var linkaddress = link.attr('data-expanded-url');
            if (!linkaddress) linkaddress = link.attr('title');
            if (!linkaddress) linkaddress = link.attr('href');
            if (linkaddress) {
              var domain = linkaddress.match(/^[a-z]+\:\/\/(?:www\.)?([^\/]+)/);
              if (domain && $.inArray(domain[1], domains) === -1) {
                domain = domain[1];
                linksmenu += '<li class="domain"><a class="tf add" data-query="'+domain+'" title="filter tweets linking to '+domain+'">'+domain+'</a></li>';
                domains.push(domain);
              }
            }
            break;
        }
      }
    }
    return menu+mentionsmenu+hashtagsmenu+linksmenu+'</ul>';
  };
  
  Tweetfilter.prototype.refreshfriends = function() { 
                                                                                                    var f=_F('refreshfriends');
                                                                                                    _D(f, 'refreshing friends, stream is', this.stream.status);
    if (!this.options['show-friends']) {
                                                                                                    _D(f, 'option is disabled.')
      return true;
    }
    if (this.friendstatus.expires < parseInt(new Date().getTime() / 1000)) {
      this.refreshcursor({
        'poll':'refreshfriends', 
        'name':'friendids',  //could use "friends" for full info, but friendids is much faster
        'resultset':'ids'
      }); 
      this.refreshcursor({
        'poll':'refreshfriends', 
        'name':'followerids',  //could use "followers" for full info, but followerids is much faster
        'resultset':'ids'
      }); 
    } else {
      this.poll('refreshcss', ['friends']);
    }
    return true;
  };
  
  Tweetfilter.prototype.getfriendstatus = function(userid) { //results of this functions are cached on stream
    if (this.cursors.friendids && this.cursors.friendids.nextcursor==='0' && 
        this.cursors.followerids && this.cursors.followerids.nextcursor==='0') {
      return this.friendstatus.hasOwnProperty(userid) ? this.friendstatus[userid] : 0;
    }
    return -1;
  };
  
  Tweetfilter.prototype.cursorfetched = function(cursor) { 
    switch(cursor.name)  {
      case 'followerids':
      case 'friendids':
        if (this.cursors.friendids && this.cursors.friendids.nextcursor==='0' && 
            this.cursors.followerids && this.cursors.followerids.nextcursor==='0') {
          if (this.friendstatus.expires < parseInt(new Date().getTime() / 1000)) {
            this.friendstatus = {expires: parseInt(new Date().getTime() / 1000)+3600}; //friend status expires in an hour, like the cursors
            for (var i=0,imax=this.cursors.friendids.items.length,friendid;i<imax && (friendid=this.cursors.friendids.items[i]);i++) {
              this.friendstatus[friendid] = 1; //following
            }
            for (var j=0,jmax=this.cursors.followerids.items.length,followerid;j<jmax && (followerid=this.cursors.followerids.items[j]);j++) {
              if (this.friendstatus.hasOwnProperty(followerid)) {
                this.friendstatus[followerid] = 4; //mutual 
              } else {
                this.friendstatus[followerid] = 2; //follower
              }
            }
            this.savesettings();
          }
          this.poll('refreshcss', ['friends']);
        }
      break;
    }
  };
  
  Tweetfilter.prototype.refreshcursor = function(cursor) {
                                                                                                    var f = _F('refreshcursor');
    if (!this.cursors[cursor.name]) { //first time
      this.cursors[cursor.name] = $.extend({}, cursor, {
        expires: 0,
        nextcursor: '-1',
        items: [],
        fetching: false
      });
    }
    cursor = this.cursors[cursor.name];
    if (cursor.expires > parseInt(new Date().getTime() / 1000)) {
                                                                                                    _D(f, 'I:'+cursor.name+' are not expired yet, sticking with cached');
      cursor.fetching = false;
      this.cursorfetched(cursor);
      return true;
    } else {
      cursor.nextcursor = '-1';
      cursor.items = [];
    }
    if (cursor.fetching) {
                                                                                                    _D(f, 'W:suspended call, already fetching!');
      return true;
    }
    if (cursor.nextcursor === '0') {
                                                                                                    _D(f, 'W:aborted fetching, nextcursor was 0');
      return true;      
    }
    cursor.fetching = true;
                                                                                                    _D(f, 'I:'+cursor.name+' now fetching.', cursor);
    this.fetchcursor(cursor);
    return true;
  }
  
  
  Tweetfilter.prototype.fetchcursor = function(cursor) {
                                                                                                    var f=_F('fetchcursor');
                                                                                                    _D(f, 'cursor:', cursor);
    var that = this;
    var params = {
      cursor: cursor.nextcursor,
      success: function(res, info) {
                                                                                                    _D(f, 'success', arguments, info);
        if (info.response[cursor.resultset].length) {
          cursor.items = cursor.items.concat(info.response[cursor.resultset]);
        }
        cursor.nextcursor = info.response.next_cursor_str;
        if (info.response.next_cursor) {
          cursor.fetching = false;
          if (cursor.poll) {
            that.poll(cursor.poll);        
          } else {
            that.fetchcursor(cursor);
          }
        } else {
          cursor.expires = parseInt(new Date().getTime() / 1000) + 3590; //expires in an hour
          cursor.fetching = false;
          that.cursorfetched(cursor);
        }
      }
    };
    switch(cursor.name) {
      case 'followerids':
        twttr.currentUser.followerIds(params);
        break;
      case 'friendids':
        twttr.currentUser.friendIds(params);
        break;
    }
  };
    
  //twitter api resolved shortened urls
  Tweetfilter.prototype.twttrajaxevent = function(event, request, settings) {
    if (settings.url.indexOf('urls/resolve') > -1 || settings.url.indexOf('/related_results/') > -1) { //resolved urls
      if (this.timeids.parselinks && this.timeids.parselinks !== -1) {
        window.clearTimeout(this.timeids.parselinks);
        this.timeids.parselinks = -1;
      }
      this.timeids.parselinks = window.setTimeout(twttr.bind(this, function() {
        this.poll('parselinks');
      }), this.heartbeat * 4);
    } else if (settings.url.indexOf('/trends/') > -1 || settings.url.indexOf('/recommendations') || settings.url.indexOf('/promos/')) { //fetched trends, who to follow, ad
      if (this.timeids.findcomponents && this.timeids.findcomponents !== -1) {
        window.clearTimeout(this.timeids.findcomponents);
        this.timeids.findcomponents = -1;
      }
      this.timeids.findcomponents = window.setTimeout(twttr.bind(this, function() {
        this.poll('findcomponents');
      }), this.heartbeat * 4);
    }
  };

  //walk through links, expand or collapse
  Tweetfilter.prototype.parselinks = function() {
                                                                                                    var f=_F('parselinks');
    if (!this.status.initialized) return false;
                                                                                                    _D(f, this.expanded);
    var showexpanded = this.options['expand-links'];
    var links = $('a.twitter-timeline-link[title]'), shownurl, shorturl, expandedurl, titleurl, checktweets=[];
                                                                                                    _D(f, 'Found', links.length, 'links on page.');
    for (var l=0,llen=links.length,link;l<llen && (link=links.eq(l));l++) {
                                                                                                    _D(f, 'processing link', link.get(0));
      if (!link.is('[data-shorturl]')) {
        shorturl = link.attr('href');
        link.attr('data-shorturl', shorturl);
      } else shorturl = link.attr('data-shorturl');
      shownurl = link.html(); //currently visible url shown in tweet
      expandedurl = link.attr('data-expandedurl') || false; //if set, its the last expanded link
      titleurl = link.attr('title').replace(/\.([^\/]{2,4})\/$/, '.$1'); //this is always the latest expanded link. funny twitter adds a slash to EVERY expanded url, we cut it off from potential
      if ((!showexpanded && shownurl !== shorturl) || (showexpanded && shownurl !== titleurl)) { //multiple shortened links
        if (showexpanded) {
          link.html(titleurl);
        } else {
          link.html(shorturl);
        }
      }
                                                                                                    _D(f, (expandedurl != titleurl ? 'W:': 'D:')+'expandedurl:', expandedurl, 'shownurl', shownurl, 'titleurl:', titleurl);
      if (expandedurl != titleurl) { //has link been expanded since last run
        link.attr('data-expandedurl', titleurl).attr('href', showexpanded ? titleurl : shorturl);
        var itemid, id;
        var item = link.closest('div.stream-item');
        if (item.length) {
          var cs = this.cs();
          if (cs && cs.hasOwnProperty('filter') && this.streamready()) {
            if (item.attr('id')) {
              id = +item.attr('id').substr(1);
              itemid = cs.filter.items[id].tweetid;
            } else {
              itemid = item.attr('data-item-id');
              if (!itemid) {
                                                                                                    _D(f, 'E:id and itemid not found!', item);
                return false;
              }
              id = cs.filter.itemids[itemid]; 
            }
                                                                                                    _D(f, 'tweet id:', id);
            
            if (id) {
                                                                                                    _D(f, 'searching tweet in filter index:', itemid);
              
              cs.filter.items[id].text += "\n"+titleurl.toLowerCase();
                                                                                                    _D(f, 'added link to text:', cs.filter.items[id].text);
                                                                                                    _D(f, 'checking tweet:', cs.filter.items[id]);
             // this.checktweet(cs.filter.items[id]);
              checktweets.push(id);
              this.refreshfiltercss();
            } else {
                                                                                                    _D(f, 'searching tweet in cache:', itemid);
              var items = cs.items;
              for (var i=0,len=items.length;i<len;i++) {
                if (items[i].id === itemid) {
                                                                                                    _D(f, 'found item with id ', itemid);
                  if (!items[i].hasOwnProperty('expandedurls')) {
                    items[i].expandedurls = '';
                  }
                                                                                                    _D(f, 'caching in item expanded urls: ', titleurl);
                  items[i].expandedurls += "\n"+titleurl.toLowerCase();
                }
              }
            }
          } else {
                                                                                                    _D(f, 'W:stream is not ready');
            return false;
          }
        } else _D(f, 'W:stream item not found!');
      }
    }
                                                                                                    _D(f, 'check tweets', checktweets);
    if (checktweets.length) {
      checktweets = this.arrayunique(checktweets);
      for (var c=0,cmax=checktweets.length;c<cmax;c++) {
        this.checktweet(cs.filter.items[checktweets[c]]);
      }
    }                                                                                                
    return true;
  };
  
  
  //create the widget and bind events, triggers loadsettings
  Tweetfilter.prototype.createwidget = function() {
                                                                                                    _D('F:createwidget', 'entering function, widget:', this.widget);
    if (!this.widget) {
                                                                                                    _D('F:createwidget', 'I:creating widget');
      this.widget = $([
        '<div id="tf" style="display:none">',
          '<div class="tf-header">',
            '<div id="tf-stream-nav">',
               '<a class="top" title="to the top" href="#" onclick="window.scrollTo(0,0); return false;"><i></i><b></b></a>'+
               '<a class="layout" data-option="filter-minimized" title="toggle Tweetfilter layout"><i class="tf-icon"></i></a>'+
               '<a class="bottom" title="to the bottom" href="#"><i></i><b></b></a>'+
            '</div>',
            '<ul class="tf-filters">',
              '<li class="passed">',
                '<a data-option="filter-inverted" title="show passed tweets">',
                  '<i>Passed</i>',
                  '<b><span id="tf-count-passed">0</span></b>',
                '</a>',
              '</li>',
              '<li class="invert">',
                '<a data-option="filter-inverted" title="show filtered tweets">',
                  '<i>Filtered</i>',
                  '<b><span id="tf-count-filtered">0</span></b>',
                '</a>',
              '</li>',
              '<li class="logo">',
                '<a class="tf-logo" data-option="filter-minimized" title="toggle Tweetfilter layout"></a>',
              '</li>',
              '<li class="filter">',
                '<a data-option="filter-links" title="filter tweets with links">',
                  '<i>Links</i>',
                  '<b id="tf-count-links">0</b>',
                '</a>',
              '</li>',
              '<li class="filter">',
                '<a data-option="filter-media" title="filter all media">',
                  '<i>Media</i>',
                  '<b id="tf-count-media">0</b>',
                '</a>',
              '</li>',
              '<li class="filter">',
                '<a data-option="filter-retweets" title="filter all retweets">',
                  '<i>Retweets</i>',
                  '<b id="tf-count-retweet">0</b>',
                '</a>',
              '</li>',
              '<li class="filter">',
                '<a data-option="filter-replies" title="filter all replies">',
                  '<i>Replies</i>',
                  '<b id="tf-count-replies">0</b>',
                '</a>',
              '</li>',
            '</ul>',
          '</div>',
          '<div class="tf-stream">',
            '<ul class="checks">',
              '<li class="streamtitle"><span id="tf-stream-title"></span></li>',
              '<li class="disable"><a data-option="filter-disabled" title="show all tweets"><b></b>disable</a></li>',
            '</ul>',
          '</div>',
          '<ul class="tf-tabs">',
            '<li class="addtofilter">',
              '<input type="text" id="tf-filter-add" value="+ Add to Tweetfilter" />',
              '<a href="http://tweetfilter.org/#usage" target="blank" title="Tweetfilter usage (tweetfilter.org)">Help</a>',
            '</li>',
            '<li class="tf-tab active">',
              '<a data-tab="filters">Filters</a>',
            '</li>',
            '<li class="tf-tab">',
              '<a data-tab="excludes">Excludes</a>',
            '</li>',
          '</ul>',
          '<div data-tab="filters">',
            '<div id="tf-scroll">',
              '<ul id="tf-filters" class="checks tf-queries">',
              '</ul>',
            '</div>',
          '</div>',
          '<div data-tab="excludes">',
            '<div id="tf-scroll">',
              '<ul id="tf-excludes" class="checks tf-queries">',
              '</ul>',
            '</div>',
          '</div>',
          '<div id="tf-customize">',
            '<ul class="tf-tabs">',
              '<li class="tf-tab active">',
                '<a data-tab="filter">Filter</a>',
              '</li>',
              '<li class="tf-tab">',
                '<a data-tab="timeline">Timeline</a>',
              '</li>',
              '<li class="tf-tab">',
                '<a data-tab="dashboard">Dashboard</a>',
              '</li>',
              '<li class="tf-tab">',
                '<a data-tab="layout">Layout</a>',
              '</li>',
              '<li class="tf-tab">',
                '<a data-tab="notify">Notify</a>',
              '</li>',
              '<li class="tf-tab">',
                '<a data-tab="more">More</a>',
              '</li>',
            '</ul>',
            '<div data-tab="filter" class="active">',
              '<ul class="checks">',
                '<li><a data-option="skip-mentionsme" class="filter" title="skip tweets mentioning me"><b></b>skip mentioning me</a></li>',
                '<li><a data-option="skip-me" class="filter" title="skip tweets written by me"><b></b>skip my posts</a></li>',
                '<li><a data-option="add-selection" class="filter" title="add selected text to filter after click"><b></b>add selection to filter</a></li>',
                '<li><a data-option="highlight-mentionsme" title="highlight tweets mentioning me"><b></b>highlight mentioning me</a></li>',
              '</ul>',
            '</div>',
            '<div data-tab="timeline">',
              '<ul class="checks">',
                '<li><a data-option="show-friends" title="show who follows you / who you follow"><b></b>show friend status</a></li>',
                '<li><a data-option="show-via" title="show tweet source"><b></b>show via in tweets</a></li>',
                '<li><a data-option="show-br" title="show line breaks in tweets"><b></b>show line breaks</a></li>',
                '<li><a data-option="expand-new" title="immediately show new tweets"><b></b>expand new tweets</a></li>',
                '<li><a data-option="expand-links" title="expand shortened links in tweets"><b></b>expand links</a></li>',
                '<li><a data-option="small-links" title="smaller link size"><b></b>small links</a></li>',
              '</ul>',
            '</div>',
            '<div data-tab="dashboard">',
              '<ul class="checks">',
                '<li><a data-option="fixed-dashboard"><b></b>fixed dashboard</a></li>',
                '<li class="disabled"><a data-option="compact-activities"><b></b>compact activities</a></li>',
                '<li class="disabled"><a data-option="hide-wtf"><b></b>hide who to follow</a></li>',
                '<li class="disabled"><a data-option="hide-trends"><b></b>hide trends</a></li>',
                '<li class="disabled"><a data-option="hide-ad"><b></b>hide advertising</a></li>',
                '<li class="disabled"><a data-option="minify-menu"><b></b>minify menu</a></li>',
                '<li class="disabled"><a data-option="expand-last"><b></b>expand last tweet</a></li>',
              '</ul>',
            '</div>',
            '<div data-tab="layout">',
              '<ul class="checks">',
                '<li><a data-option="hide-topbar"><b></b>auto-hide top bar</a></li>',
                '<li><a data-option="hide-question"><b></b>hide question</a></li>',
                '<li><a data-option="hide-tweetbox"><b></b>hide main tweet box</a></li>',
              '</ul>',
            '</div>',
            '<div data-tab="notify">',
              '<ul class="checks">',
                '<li><a data-option="alert-message" title="alert when received new direct messages"><b></b>alert new dm</a></li>',
                '<li><a data-option="alert-sound-message" title="play sound when received new direct messages"><b></b>sound on new dm</a></li>',
                '<li><a data-option="alert-mention" title="alert when received new mentions"><b></b>alert new mentions</a></li>',
                '<li><a data-option="alert-sound-mention" title="play sound when received new mentions"><b></b>sound on new mentions</a></li>',
              '</ul>',
            '</div>',
            '<div data-tab="more">',
              '<ul class="checks">',
                '<li><a data-option="clear-stream-cache" title="always reload the timeline after page switch (which is faster on some browsers)"><b></b>disable timeline cache</a></li>',
                '<li><a title="drag to your favorites bar" id="tf-export-settings">Tweetfilter settings</a></li>',
              '</ul>',
              '<div class="about">',
                '<ul>',
                  '<li class="version">Tweetfilter '+this.version+'</li>',
                  '<li class="website"><a href="http://tweetfilter.org" target="_blank">Visit website</a></li>',
                  '<li class="follow"><a href="#">Follow @tweetfilterjs</a></li>',
                  '<li class="support"><a href="#" target="_blank">Show ♥</a></li>',
                '</ul>',
              '</div>',
              '<div class="support">',
                '<p>Thanks for supporting Tweetfilter!</p>',
              '</div>',
            '</div>',
          '</div>',
        '</div>'
        ].join("\n")
      );
      $('#page-outer').append(this.widget);
      var that = this;
      //set input field active on focus, catch enter
      $('#tf input[type=text]').live('focus', function() {
        var input = $(this);
        if (!input.hasClass('active')) {
          input.addClass('active').attr('data-idlevalue', input.val()).val('');
        }
      })
      //set filter input inactive on blur, set idle text if empty
      .live('blur', function() {
        var input = $(this);
        if (!input.val()) {
          input.removeClass('active').val(input.attr('data-idlevalue'));
        }
      });
      //override twitters hotkey feature for the filter input
      this.widget.delegate('input', 'keydown keypress keyup', function(e) {
        if (e.type === 'keydown' && e.which === 13) {
          /* add query to filter by pressing enter */
          var queryid;
          if ((queryid = that.addquery($('#tf-filter-add').val()))) {
            $('#tf-filter-add').val('').focus();
            _D('F:addtofilterinput', e, queryid, $('#tf-filter-add').val());
            if (e.ctrlKey) {
              this.setexclusive(queryid);
              this.poll('refreshfilterlist');            
              this.poll('setstreamtitle');
              this.poll('removeselection');
              this.refreshfiltercss();              
            }
          }
        }
        e.stopPropagation();
      })
      //click an option
      .delegate('a[data-option]', 'mousedown', function(e) {
        var sender = $(this), sendersparent=sender.closest('li');
        var optionname = sender.attr('data-option');
        if ((!sender.hasClass('disabled') && !sendersparent.hasClass('disabled')) || (that.exclusive.length && optionname === 'filter-inverted')) {
          switch(e.which) {
            case 1:
              if (!e.ctrlKey) {
                var status = !sender.hasClass('checked');
                if (optionname === 'filter-inverted') {
                  status = sendersparent.hasClass('invert');
                }
                that.setoption(optionname, status, true);
                $('a[data-option="'+optionname+'"]', that.widget).toggleClass('checked', that.options[optionname]);
                if (optionname === 'filter-inverted') {
                  $('.passed a[data-option="'+optionname+'"]', that.widget).toggleClass('checked', !that.options[optionname]);
                }
                break;
              }
              //fall through
            case 2:
              var exclusiveoption;
              if (optionname.substr(0,6)=='filter' && (exclusiveoption=optionname.substr(7)) &&
                  $.inArray(exclusiveoption, ['replies','retweets','media','links']) > -1) 
              {
                that.setexclusive(exclusiveoption);
                sender.toggleClass('exclusive');
                this.poll('refreshfilterlist');            
                this.poll('setstreamtitle');            
                that.refreshfiltercss();
              } 
              break;
          }
        }
        return false;
      })
      //delete a query from the list clicking 'x'
      .delegate('a.x', 'click', function() {
        var queryid = $(this).prev().attr('data-queryid');
        if (queryid) {
          that.setquerystatus(queryid, -1);
        }
        return false;
      })
      //toggle a query 
      .delegate('a[data-queryid]', 'mousedown', function(e) {
        switch(e.which) {
          case 1:
            if (!e.shiftKey) {
              that.setquerystatus($(this).attr('data-queryid')*1, !$(this).hasClass('checked'));
              break;
            }
            //fall through
          case 2: //mouse wheel click or shift+click on query sets exclusive filters overriding all other options
            $(e.target).closest('li').toggleClass('exclusive');
            that.setquerystatus($(this).attr('data-queryid')*1, -2);
            break;
          default:
            return true;
          break;
        }
        return false;
      })
      //click an option tab
      .delegate('a[data-tab]', 'click', function() {
        var tab = $(this).attr('data-tab');
        var li = $(this).parent();
        var target=$('div[data-tab='+tab+"]", this.widget);
        if (li.hasClass('active')) {
          target.removeClass('active');
          li.removeClass('active');
        } else {
          target.siblings('div[data-tab]').removeClass('active').end().addClass('active');
          li.siblings('li').removeClass('active').end().addClass('active');
        }
      })
      .delegate('a.bottom', 'click', function() {
        try {
          var h = document.documentElement.scrollHeight - document.documentElement.clientHeight; 
          window.scrollTo(0, h); 
          twttr.app.currentPage().streamManager.getCurrent().getMoreOldItems();
        } catch(e) {}
        return false;
      }).delegate('#tf-export-settings', 'mouseenter', function() {
        var settings = that.getvalue(':TWEETFILTER:', {})[that.user.id];
        delete settings['relationships'];
        settings.messagesinceid = settings.mentionsinceid = -1;
        $('#tf-export-settings').attr('href', "javascript:(function() { twtfilter.loadsettings("+JSON.stringify(settings)+"); })();");    
        return false;
      }).delegate('li.support > a', 'click', function() {
        new twttr.widget.TweetDialog({
          modal: false,
          draggable: true,
          defaultContent: "Tweetfilter ♥ http://tweetfilter.org",
          template: {
            title: _("Thank you! <3")
          },
          origin: "Tweetfilter "+that.version
        }).open().focus();        
      }).delegate('li.follow > a', 'click', function() {
        twttr.currentUser.isFollowing('tweetfilterjs', function(isfollowing) {
          if (!isfollowing) {
            var tweetfilterjs = twttr.API.User.find('tweetfilterjs');
            tweetfilterjs.follow({
              success: function() {
                that.showmessage('Thanks for following!')
              },
              error: function (e) { //redirect if following through api failed
                window.location.hash = '#!/tweetfilterjs';
              }
            })
          } else {
            that.showmessage('You are already following @tweetfilterjs.<br />See <a href="http://tweetfilter.org" target="_blank">tweetfilter.org</a> if you missed any updates.', {resident:true});
          }
        })
      });
      //set initial active tab
      $('.active a[data-tab]', this.widget).each(function() {
        $('div[data-tab="'+$(this).attr('data-tab')+'"]').toggleClass('active', true);
      });
    }
  };
  
  Tweetfilter.prototype.setexclusive = function(queryid) {
    var queryfound = false;
    if (typeof queryid === 'number') {
      for (var q=0,len=this.queries.length;q<len;q++) {
        if (this.queries[q].id === queryid) {
          queryfound = true;
          break;
        }
      }
      if (!queryfound) return;
    }
    var exclusivemode = this.exclusive.length > 0;
    var i = exclusivemode ? $.inArray(queryid, this.exclusive) : -1;
    if (i === -1) {
      if (typeof queryid === 'number') {
        this.exclusive.push(queryid);
        if (!this.queries[q].enabled) {
          this.queries[q].wasdisabled = true;
          this.queries[q].enabled = true;
          this.poll('refreshfilterlist');
        }
      } else {
        this.exclusive.unshift(queryid);
      }     
      if (!exclusivemode) { //entering exclusivemode
        this.refreshoptions();
        window.scrollTo(0,0); //needed if you scrolled down many pages
      }
    } else {
      this.exclusive.splice(i, 1);
      if (typeof queryid === 'number') {
        if (this.queries[q].enabled && this.queries[q].wasdisabled) {
          this.queries[q].enabled = this.queries[q].wasdisabled = false;
          this.poll('refreshfilterlist');
        }
      }
      if (!this.exclusive.length) { //exiting exclusivemode
        this.refreshoptions();
      }
    }
    this.setstreamtitle();
  };
  
  //refresh widget filter check list
  Tweetfilter.prototype.refreshfilterlist = function() {
    if (!this.widget) return true; 
                                                                                                    _D('F:refreshfilterlist');
    var query;
    var listitems = {
      excludes: [],
      filters: []
    };
    var category;
    var exclusivemode = this.exclusive.length > 0;
    for (var i=0,len=this.queries.length; i<len; i++) {
      query = this.queries[i];
      category = query.excluded ? 'excludes' : 'filters';
      var action = '';
      if (!this.options['filter-inverted']) {
        action = query.enabled ? 'show' : 'hide';
      } else {
        action = query.enabled ? 'hide' : 'show';
      }
      action = action + ' tweets';
      switch(query.type) {
        case 'user':action += ' from';break;
        case 'source':action += ' via';break;
        default:action += ' containing';break;
      }
      listitems[category].push('<li class="'+query.type+(!query.count ? ' notfound' : '')+(exclusivemode && $.inArray(query.id, this.exclusive) > -1 ? ' exclusive' : '')+'">'+
         '<span>'+
           '<a data-queryid="'+query.id+'"'+(query.enabled ? ' class="checked"' : '')+' title="'+this.encodehtml(query.index)+'">'+
             '<b></b><span>'+this.encodehtml(query.label)+'</span>'+
             '<i id="tf-count-'+query.id+'">'+(query.count ? query.count : '--')+'</i>'+
           '</a>'+
           '<a class="x" title="remove from filter">×</a>'+
         '</span>'+
        '</li>');
    }
    for (category in listitems) {
      if (listitems[category].length) {
        $('#tf-'+category).html(listitems[category].join("\n")).parent().show();
      } else {
        $('#tf-'+category).empty().parent().hide();
      }
    }
    return true; //don't requeue in poll
  };


  //set style element contents
  Tweetfilter.prototype.setcss = function(id, styles) {
                                                                                                    _D('F:setcss', id);
    id = 'tf-'+id;
    if ($.browser.msie) { //apparently jquery does not handle this correctly on IE
      for (var i = 0; i < document.styleSheets.length; i++) {
        if (document.styleSheets[i].id === id) {
          document.styleSheets[i].cssText = styles;
          return;
        }
      }
    } else { //all others: directly set element contents
      $('style#'+id).html(styles);
    }
  };
  
  Tweetfilter.prototype.css3gradient = function(startcolor, endcolor, vertical) {
    vertical = typeof vertical === 'undefined' ? 0 : +vertical;  
    var css = ['background-color: '+startcolor]; //fallback to solid fill
    var start = vertical ? 'top' : 'left'; 
    if ($.browser.mozilla) {
      css = css.concat([
        'background-image: -moz-linear-gradient('+start+', '+startcolor+', '+endcolor+')' /* FF3.6 */
      ]);
    } else if ($.browser.webkit) {
      css = css.concat([
        'background-image: -webkit-gradient(linear, left top, '+(vertical ? 'left bottom' : 'right top')+', from('+startcolor+'), to('+endcolor+'))', /* Saf4+, Chrome */
        'background-image: -webkit-linear-gradient('+start+', '+startcolor+', '+endcolor+')' /* Chrome 10+, Saf5.1+ */
      ]);      
    } else if ($.browser.msie) { //don't really know why I'm supporting IE
      css = css.concat([
       'background-image: -ms-linear-gradient('+start+', '+startcolor+', '+endcolor+')', /* IE10 */
       "filter: progid:DXImageTransform.Microsoft.gradient(GradientType='"+vertical+"',startColorstr='"+startcolor+"',endColorstr='"+endcolor+"')",  /* IE 8*/
      ]);      
    } 
    css = css.concat([ //always include the w3c method
     'background-image: linear-gradient('+start+', '+startcolor+', '+endcolor+')' /* W3C */
    ]);
    return css.join(';')+';'; 
  };
  
  Tweetfilter.prototype.css3shadow = function(blur, color, hoffset, voffset) {
    if (!Modernizr.boxshadow) {  
      return 'border:1px solid '+color+'; ';
    }
    if (typeof hoffset !== 'string') hoffset = '0';
    if (typeof voffset !== 'string') voffset = '0';
    var offset = blur !== 'none' ? hoffset+' '+voffset+' ' : '';
    var css = [];
    if ($.browser.webkit) {
      css.push('-webkit-box-shadow: '+offset+blur+' '+color);
    } else if ($.browser.mozilla) {
      css.push('-moz-box-shadow: '+offset+blur+' '+color);
    }
    css.push('box-shadow: '+offset+blur+' '+color);
    return css.join(';')+';'; 
  };
  
  Tweetfilter.prototype.css3rounded = function(radius) {
    if (!Modernizr.borderradius) {
      return '';
    }
    var css = [];
    if ($.browser.mozilla) {
      css = css.concat([ //always include the w3c method
        '-moz-border-radius: '+radius
      ]);
    } else if ($.browser.webkit) {
      css = css.concat([ //always include the w3c method
        '-webkit-border-radius: '+radius,
        '-webkit-background-clip: padding-box'
      ]);
    }
    css = css.concat([ 
      'border-radius: '+radius,//always include the w3c method
      'background-clip: padding-box'
    ]);
    return css.join(';')+';'; 
  };
 
  Tweetfilter.prototype.arrayunique = function(a) {
    for (var i=0; i < a.length; ++i) {
      for (var j=i+1; j < a.length; ++j) {
        if (a[i] === a[j]) {
          a.splice(j, 1);
        }
      }
    }
    return a;
  };
  
  Tweetfilter.prototype.refreshindex = function() {
    var cs;
    if ((cs = this.cs())) {
      if (cs.streamItemType !== 'tweet') {
        return true;
      }
      if (!cs.hasOwnProperty('filter')) {
        this.poll('parseitems');
        return true; 
      }
      var matchcount, targetcounter, exclusivemode = this.exclusive.length > 0, hidden = [], excluded = [];
      if (!exclusivemode) {
         /* filter all retweets */
        if (this.getoption('filter-retweets') && this.stream.namespace != 'RetweetsByOthers' && this.stream.namespace != 'RetweetsByYou' && cs.filter.retweets.length) {
          hidden = hidden.concat(cs.filter.retweets);
        }
        if (this.getoption('filter-replies') && cs.filter.replies.length) {
          hidden = hidden.concat(cs.filter.replies);
        }
        if (this.getoption('filter-links') && !(this.stream.params.hasOwnProperty('mode') && this.stream.params.mode==='links') && cs.filter.links.length) {
          hidden = hidden.concat(cs.filter.links);
        }
        /* filter all media */
        if (this.getoption('filter-media') && cs.filter.media.length) {
          hidden = hidden.concat(cs.filter.media);
        }
      } else {
        if ($.inArray('retweets', this.exclusive) > -1 && cs.filter.retweets.length) {
          hidden = hidden.concat(cs.filter.retweets);
        }
        if ($.inArray('replies', this.exclusive) > -1 && cs.filter.replies.length) {
          hidden = hidden.concat(cs.filter.replies);
        }
        if ($.inArray('links', this.exclusive) > -1 && cs.filter.links.length) {
          hidden = hidden.concat(cs.filter.links);
        }
        if ($.inArray('media', this.exclusive) > -1 && cs.filter.media.length) {
          hidden = hidden.concat(cs.filter.media);
        }
      }
      for (var q=0, query, qmax=this.queries.length; q<qmax && (query=this.queries[q]); q++) {
        matchcount = 0;
        if (query.user && !query.regular && cs.filter.users.hasOwnProperty(query.search) && (matchcount=cs.filter.users[query.search].length) && matchcount) { //user filter: count tweets by this user
          if (query.enabled && query.excluded && !exclusivemode) { //excluded do not count in exclusivemode
            excluded = excluded.concat(cs.filter.users[query.search]);
          } else if (query.enabled && (!exclusivemode || $.inArray(query.id, this.exclusive) > -1)) {
            hidden = hidden.concat(cs.filter.users[query.search]);
          }
          query.count = matchcount;
        } else if (cs.filter.matches.hasOwnProperty(query.index) && (matchcount=cs.filter.matches[query.index].length) && matchcount) { //count tweets with match
          if (query.enabled && query.excluded && !exclusivemode) {
            excluded = excluded.concat(cs.filter.matches[query.index]);
          } else if (query.enabled && (!exclusivemode || $.inArray(query.id, this.exclusive) > -1)) {
            hidden = hidden.concat(cs.filter.matches[query.index]);
          }
          query.count = matchcount;
        } else {
          query.count = 0;
        }
        targetcounter = $('#tf-count-'+query.id);
        targetcounter.html(query.count);
        targetcounter.parents('li').toggleClass('notfound', !query.count); 
      }

      if (!exclusivemode) { //exclusivemode is a special mode, would be irritating having own posts _always_ mixed in
        if (this.getoption('skip-me') && cs.filter.me.length) {
          excluded = excluded.concat(cs.filter.me);
        }
        if (this.getoption('skip-mentionsme') && cs.filter.mentionsme.length) {
          excluded = excluded.concat(cs.filter.mentionsme);
        }
      }
      cs.filter.excluded = excluded;
      cs.filter.hidden = hidden;
      cs.filter.passed = this.arraydiff(cs.filter.tweets, hidden);
      
    }
    return true;
  };
  
  //build css from filter settings, filters and/or options and set it
  Tweetfilter.prototype.refreshcss = function(which) { 
                                                                                                    _D('F:refreshcss', which);
    var style = [];
    var name;
    var cs = this.cs();
    if (!cs.hasOwnProperty('filter')) {
      this.poll('parseitems');
      return true; 
    }
    for (var i in which) {
      style = [];
      name = which[i];
      switch(name) {
        case 'filter': //anything that hides/shows tweets
          if (this.options['filter-disabled'] || !this.streamready() || this.stream.itemtype !== 'tweet') {
            style.push('.tweet-actions > a.tf.menu { display:none !important; }'); //hide the "add to filter" dropdown in stream while disabled
            this.setcss(name, style.join("\n"));
            $('[id^="tf-count-"]', this.widget).html('--'); //set counters idle 
                                                                                                    _D('F:refreshcss', 'W:suspending filter. stream itemtype: ', this.stream.itemtype, ', mode:', this.stream.mode, ', filter disabled:', this.options['filter-disabled']);
            break;
          }
                                                                                                    _D('F:refreshcss', 'W:refreshing filter css');
          this.refreshindex();
          var exclusivemode = this.exclusive.length > 0;
          var hidecss = 'display:none;';
          var showcss = 'display:block;';
          var inverted = this.options['filter-inverted'];
          //.stream-tabs .stream-tab
          if (exclusivemode) {
             style.push('div.stream-items > div.stream-item { '+hidecss+'}'); //hide all tweets
             style.push('#t'+cs.filter.hidden.join(',#t')+' { '+(showcss)+'}');
          } else {
            if (inverted) {
              style.push('div.stream-items > div.stream-item { '+hidecss+'}'); //hide all tweets
              //inverted: show only hidden
              if (cs.filter.hidden.length) {
                style.push('#t'+cs.filter.hidden.join(',#t')+' { '+showcss+'}');
              }
            } else {
              //show only passed, excluded
              style.push('div.stream-items > div.stream-item { '+hidecss+'}'); //hide all tweets
              if (cs.filter.passed.length) {
                style.push('#t'+cs.filter.passed.join(',#t')+' { '+showcss+'}');
              }
              if (cs.filter.excluded.length) {
                style.push('#t'+cs.filter.excluded.join(',#t')+' { '+showcss+' }');
              }
            }
          }
          /* highlight replies to me */
          if (this.options['highlight-mentionsme'] && this.stream.namespace !== 'Mentions' && cs.filter.mentionsme.length) { //highlight tweets mentionining current user
            var startcolor = twttr.helpers.hexToRGBA(this.colors.reply, '0.4');
            style.push('#t'+cs.filter.mentionsme.join(',#t') + ' { '+this.css3gradient(startcolor, '#FFFFFF')+' }'); //gradient
          }
          $('body').toggleClass('tf-filter-inverted', inverted);
          this.setcss(name, style.join("\n"));
          $('#tf-count-items').html(cs.filter.items.length); //all tweets in timeline
          $('#tf-count-filtered').html(cs.filter.hidden.length); //filtered (hidden) tweets
          $('#tf-count-passed').html(cs.filter.passed.length); //tweets wich passed all filters
          $('#tf-count-retweet').html(cs.filter.retweets.length);
          $('#tf-count-media').html(cs.filter.media.length);
          $('#tf-count-replies').html(cs.filter.replies.length);
          $('#tf-count-links').html(cs.filter.links.length);
          break;
        case 'friends':
          if (this.friendstatus.expires) { //is 0 at init, > 0 means it's loaded
            if (this.options['show-friends']) { //show friend status icon
              var following=[], follower=[], mutual=[], css = [], username, userid;
                                                                                                      _D('F:refreshcss', 'W:refreshing friends css');
              for (userid in this.friendstatus) {
                switch(this.friendstatus[userid]) {
                  case 1:following.push(userid);break;
                  case 2:follower.push(userid);break;
                  case 4:mutual.push(userid);break;
                }
              }
              if (following.length) css.push('i.u'+following.join(',i.u') + ' { padding-right:14px; background-position: right 3px !important; }');
              if (follower.length) css.push('i.u'+follower.join(',i.u') + ' { padding-right:14px; background-position: right -16px !important; }');
              if (mutual.length) css.push('i.u'+mutual.join(',i.u') + ' { padding-right:14px; background-position: right -35px !important; }');
              this.setcss(name, css.join("\n")); //friend status
            } else this.setcss(name, '');
          }
          break;
          
        
        case 'layout':
                                                                                                    _D('F:refreshcss', 'W:refreshing layout css');
         style = [
          'html { overflow-y:scroll; min-height:100%; }', //force scrollbar, remove horizontal jumps (opera)
          '#tf { display:block !important; bottom: 0; margin-left: 586px; position: fixed; text-align:left; '+this.css3rounded('0 4px 0 0')+' font-family:Arial,"Helvetica Neue",Helvetica,sans-serif; background:#fff; position:fixed; bottom:0; z-index:1; width: 385px; '+this.css3shadow('2px', 'rgba(0, 0, 0, 0.3)')+' border:1px solid #bbb; border-bottom:0; }',
          '#tf * { padding:0; margin:0; list-style:none; color:@darktext; }',
          //icon sprites
          ".tf-icon { background-image: url('data:image/png;base64,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') !important; }",
          ".tf-spin { background: url('data:image/gif;base64,R0lGODlhDAAMAPcAAP////////////r6+vHx8evr6/39/f////////////////////////////Ly8tLS0ry8vLe3t/j4+P7+/v39/f7+/v////////////Ly8sfHx7q6us/Pz+Li4v39/f7+/vv7+/v7+/7+/v////v7+9XV1by8vOPj4/39/f////////////39/fj4+Pr6+v7+/vLy8sTExNPT0/39/f////////////////////n5+fb29v39/e3t7b29veXl5f////////////////////////r6+vHx8fv7++7u7sDAwObm5v////////////////////////j4+O7u7vr6+vT09MvLy9nZ2f39/f////////////////7+/vLy8u7u7vv7+/v7+93d3crKyurq6v39/f////////7+/vT09Ojo6PHx8f7+/v////X19dbW1s/Pz+Dg4O3t7fDw8Onp6eLi4urq6vr6+v////////////X19eLi4tfX19TU1NfX1+Dg4Ozs7Pr6+v////////////////////z8/Pf39/Pz8/T09Pj4+P39/f///////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAQKAAAAIf4aQ3JlYXRlZCB3aXRoIGFqYXhsb2FkLmluZm8AIf8LTkVUU0NBUEUyLjADAQAAACwAAAAADAAMAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////7+/vy8vLr6+vr6+vx8fH6+vr////////////////////z8/PX19fDw8O4uLi1tbW+vr7S0tLx8fH////////////09PTPz8/CwsLU1NTk5OTi4uLPz8+3t7fQ0ND////////7+/vb29vFxcXn5+f9/f3////////8/Pzn5+f29vb////////19fXNzc3a2tr9/f3////////////////////+/v79/f3////w8PDIyMjp6en////////////////////////+/v76+vr+/v7x8fHLy8vr6+v////////////////////////9/f34+Pj9/f329vbV1dXh4eH+/v7////////////////////5+fn39/f9/f38/Pzk5OTW1tbv7+/+/v7////////+/v75+fny8vL4+Pj+/v7////39/ff39/a2tro6Ojz8/P09PTx8fHt7e3y8vL8/Pz////////////4+Pjp6enh4eHg4ODk5OTq6ury8vL8/Pz////////////////////9/f35+fn39/f4+Pj6+vr9/f3///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////7+/v09PTu7u7t7e3z8/P7+/v////////////////////19fXe3t7Nzc3CwsK/v7/GxsbW1tby8vL////////////29vbY2NjMzMzb29vn5+fm5ubV1dW+vr7IyMjy8vL////8/Pzi4uLR0dHr6+v9/f3////////9/f3k5OS6urrT09P6+vr39/fX19fh4eH9/f3////////////////9/f3Pz8+9vb3x8fHz8/PU1NTu7u7////////////////////////j4+O3t7fr6+v09PTX19fw8PD////////////////////////9/f34+Pj9/f34+Pjg4ODp6en+/v7////////////////////+/v7////////9/f3r6+vh4eH09PT+/v7////////////9/f36+vr9/f3////////5+fnp6enm5ubw8PD39/f5+fn39/f39/f6+vr+/v7////////////6+vrw8PDs7Ozs7Ozv7+/09PT5+fn+/v7////////////////////+/v77+/v6+vr7+/v8/Pz+/v7///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////8/Pz29vbx8fHw8PD19fX7+/v////////////////////39/fk5OTW1tbMzMzJycnOzs7c3Nz09PT////////////4+Pjg4ODW1tbh4eHr6+vq6ura2trGxsbPz8/z8/P////9/f3p6enb29vv7+/9/f3////////9/f3n5+fDw8PY2Nj6+vr5+fnh4eHo6Oj+/v7////////////////9/f3U1NTDw8Py8vL29vbf39/y8vL////////////////////////k5OS3t7fr6+v39/fi4uL09PT////////////////////////i4uK1tbXr6+v6+vrp6enw8PD+/v7////////////////8/PzOzs69vb3x8fH9/f3y8vLr6+v39/f+/v7////////////5+fm+vr7R0dH6+vr////7+/vx8fHv7+/29vb7+/v9/f38/Pz9/f3x8fHw8PD////////////8/Pz29vb09PT19fX4+Pj7+/v9/f3////////////////////////+/v79/f38/Pz9/f3+/v7///////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////9/f34+Pj19fX09PT39/f8/Pz////////////////////6+vrs7Ozh4eHa2trX19fZ2dnk5OT29vb////////////6+vrq6urj4+Pq6urx8fHv7+/j4+PT09PZ2dn19fX////+/v7x8fHn5+f09PT+/v7////////+/v7s7OzOzs7e3t77+/v7+/vs7Ozw8PD+/v7////////////////9/f3c3NzNzc309PT6+vrs7Oz39/f////////////////////////n5+fCwsLu7u77+/vv7+/5+fn////////////////////////m5ua/v7/t7e38/Pzz8/P39/f////////////////////9/f3U1NTFxcXz8/P+/v74+Pj29vb8/Pz////////////9/f3j4+O9vb3W1tb7+/v////9/f35+fn5+fn9/f3////19fXOzs65ubnHx8fy8vL////////////+/v78/Pz8/Pz////r6+u8vLzS0tLy8vL////////////////////////+/v7////6+vrx8fH6+vr///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////9/f37+/v4+Pj39/f5+fn9/f3////////////////////8/Pzz8/Ps7Ozm5ubj4+Pk5OTr6+v4+Pj////////////8/Pzy8vLu7u7y8vL19fX09PTr6+vd3d3i4uL4+Pj////+/v739/fx8fH5+fn+/v7////////+/v7x8fHZ2dnm5ub8/Pz9/f329vb39/f////////////////////+/v7j4+PY2Nj29vb9/f329vb8/Pz////////////////////////s7OzOzs7x8fH9/f34+Pj9/f3////////////////////////q6urKysrw8PD+/v77+/v8/Pz////////////////////9/f3b29vOzs719fX////9/f39/f3////8/Pz////////9/f3n5+fGxsbc3Nz7+/v////////9/f3i4uLOzs7h4eHi4uLT09PCwsLPz8/09PT////////////8/PzT09O8vLy0tLS2trbCwsLX19fz8/P////////////////////6+vrx8fHq6urr6+vy8vL7+/v///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////+/v79/f37+/v6+vr7+/v+/v7////////////////////+/v75+fn19fXx8fHu7u7u7u7y8vL6+vr////////////+/v76+vr39/f4+Pj6+vr4+Pjy8vLp6enr6+v6+vr////////8/Pz6+vr9/f3////////////+/v729vbk5OTt7e39/f3+/v78/Pz9/f3////////////////////+/v7r6+vj4+P5+fn////////////////////////////////////x8fHa2tr19fX6+vrr6+v09PT////////////////////////v7+/W1tb09PTw8PC7u7vOzs79/f3////////////////+/v7i4uLZ2dn39/f6+vrR0dG4uLji4uL9/f3////////9/f3r6+vR0dHj4+P8/Pz////x8fHHx8e7u7vT09Pl5eXm5uba2trLy8vY2Nj29vb////////////y8vLV1dXDw8O9vb3AwMDLy8vd3d319fX////////////////////7+/vy8vLt7e3u7u709PT7+/v///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgAh+QQECgAAACwAAAAADAAMAIf////////////////+/v7+/v79/f39/f3+/v7////////////////////////+/v78/Pz6+vr4+Pj39/f4+Pj9/f3////////////x8fHy8vL+/v7+/v7+/v79/f35+fnz8/P09PT8/Pz////6+vrR0dG+vr75+fn////////////////5+fnv7+/09PT+/v7x8fG9vb3Ozs78/Pz////////////////+/v7y8vLt7e37+/vq6uq0tLTh4eH////////////////////////29vbm5ub4+Pjr6+u2trbi4uL////////////////////////09PTj4+P39/fy8vLCwsLT09P9/f3////////////////+/v7q6urk5OT5+fn7+/vX19fAwMDm5ub9/f3////////9/f3w8PDc3Nzq6ur9/f3////z8/PNzc3ExMTZ2dnp6enr6+vh4eHX19fh4eH4+Pj////////////09PTb29vMzMzIyMjLy8vW1tbl5eX39/f////////////////////7+/v09PTw8PDx8fH29vb8/Pz///////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIpQABBBAwgEABAwcQJFCwgEEDBw8gRJAwgUIFCxcwZNCwgUMHDx9AhBAxgkQJEydQpFCxgkULFy9gxJAxg0YNGzdw5NCxg0cPHz+ABBEyhEgRI0eQJFGyhEkTJ0+gRJEyhUoVK1ewZNGyhUsXL1/AhBEzhkwZM2fQpFGzhk0bN2/gxJEzh04dO3fw5NGzh08fP38ABRI0iFAhQ4cQJVK0iFEjR48CAgA7') no-repeat top center !important; }",
          ".tf-support { background: url('data:image/gif;base64,R0lGODlhRgAeAPf/AKTGfNHax+HosqG8zfr+/8XbpXimvOHx+tHhpn+nTe3z5fz+/3GmMf7Tc5S1bCKazv/kp4WpS+fw3JO+X4ypbYSqVWGTqqTBgZXAYvy6N9nq947D25S/YKzR5wA7ZxiTyXiWUOLp2Iy4Vr3ToYuwxKrMgfL27pu5dLXLm67IkKzCkbXN2tXn9IGoUf3GdrTSkQJWgqnP5o6xY/q0P0mmzZ3Db/vFan+oUFaNp466WKi9i+31+cXa5zp7mKvGiue0jPq3VJa6a+Xv+bzXm93u9O7s8U6Iop+2ft3p0Pb4/ZClcvT57uDt0cPSsOHu9v79+liSrvLu9/SnT4muXOnx+pK2x/b9/vL5/H6pT+n4+/z69Ovq7un0+bjR34KuwzmcxoSlW77Oqoq3U4usVJm4etrp8yFoiNvqyQeCt6nHabHNZM7dvrnMpnulSYOpVNPi6vT5/Za7RvioP2euz4WrVtyMR9h9O5G8Xf7RbPr4/fr6+X6tR97i2tXhxdXm8Z+8efrIj/D2+uTi34CpvNjd0AJ5rpnEZczh65C9WNPl8uXw957Cc9/x+Rhjhpq7zLHGlPb7/hh1nNzp8wWNxpW0cKfO53WfP+v2/dniz+rw9kOCn5G7XoeyUt7s89fn9ebj4a7N26fF05qxeYKwTYmwWbLRjZy0e5O/Xd/m15GyZ5a9zoesWbTNlafBiubs3tjn8ZK8XqLO6H+gVpO/X/D35/Tw+arP5+jn6p3G4Pf5/d6deilxj/vXqp+3f/38/FyjvbjTeaDB0I+7W/Py3d+IOPSbPa/OiIyjbf7155nAavP4+/X5/e34/oOqU+CddISuUt7t92GYstvs9c7awMHX4UuTrebrwv737P7rxiZvj//wz5G+XZG9XbnPn7fUlIClROrz+6jCh8jWtczVu8/eteby+eb0+vb08fT6/yF3nPj8/vzASQ6QxvPw+KTESPD4//f2+9nkw5/AScbLqm+guDmBoQBkmr7HorbIpC+g0XqYUYatV4SkWJG8Xv///////yH/C1hNUCBEYXRhWE1QPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS4wLWMwNjAgNjEuMTM0Nzc3LCAyMDEwLzAyLzEyLTE3OjMyOjAwICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3MiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RkIxOEE2RTc5QTgxMTFFMDlDOTFEQkZERTlFODRFOEIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RkIxOEE2RTg5QTgxMTFFMDlDOTFEQkZERTlFODRFOEIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpGQjE4QTZFNTlBODExMUUwOUM5MURCRkRFOUU4NEU4QiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpGQjE4QTZFNjlBODExMUUwOUM5MURCRkRFOUU4NEU4QiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAP8ALAAAAABGAB4AAAj/AHHZ6kCwoMGDCBMq7GAL17+HECNKnEjxXyV/GDNq3Mixo8eMlSqKHPmww8eTKD92IMlyosllC/wlyQXJn68d6pZxzMWzp0+fMAnwTOJvZcuj/0wSyLQjY5d0oDBKIuEoGIk3/pZBWkYzl7qcWtVBIqCOwIJlcIoiPWrLH4FOkaLpCVTIXj2Mr6A0ggEFa0wCgP2hw0jA3xWM9AwYDuTP1tqWMfw13QAjEo0PD2AEcxKzSjR/OA45yeaPBIkVZnpIA23msxkPJCT7i/GYZQwrXJj5o4EG8wM0mgsbMALaiyoPnYwMyhbIQA8vPfw1cmQAir9L5azQrj0yhrpEijDm/3vwYNIXRYq4+Bvub4WmHlV6aKIGg4QBL0Z6OILSJbE/9Ms4xp1ItkAiRDW/zPHBB5MUEhU4TvgTTXTSkeYBPf6YoQoJPHTRSBeDEEAPDDy8I4QyAg5IUQxc7BCIgux8QAM1vhBhYxbUrHCJFaFQ408VZfjzBg4WHOJPKJoMsoM5FlTBDBE7bKfiRJVQUUZ4gTihSCDqaCDJl6+8Y0UZr6gzpj/g+DGYP8wEiRE0VLhVRhmZhDTlRDFQoYEnGjghhBDQ8KnBoHuyMKgnhrLAJwuJJLIoo4UaqgEVUt4JUSyMHKDpAYxkuumnoIYqKqiM2GkpRCvgMsCqrLbq6quwxv86QCixnBqRAiroYMoRvPbq6xGmgMHPsMQWa+yxyCar7LE6mHBECCn5Q4shwvRj7bXYZqvtttx2my0dOvSSkTYNlGsuHhBgNO02s7TLAQbwvtvuvLNgwEG79tI7b77y7nvvvP26uwk/R2CEzToZJKxwAwIIIK0h3EwwAQcijLLHKCLscYfEHI/CCQZ37CECBxxLHLIIGOSwhzAkc7OHGCRPrDLLEs/SD8EY2TDDDDbYAMQMLlijBgIPR8yBGFM8wkYKi7BhLwdQT4CCD4gkwwYAiEwcNQZXI9J0MqfU2wQA3EC9TQ1sJBPxBDbzI+4TQMhhwzXIAOHCMMC4Q/S0EZ//4oArGEkwhD/JJHDDDViI8UQfltTgTwpt5IDFDfuc7Q8rlrzgTxBtYLFJK4uMcngbxvhTQg41D2yKP09IIQcgrPOihQJqyLM3xBPkQI4vKDyzx+ClY4RKELRgFDwtQaDizxliOO6PApqL4880yegxRDh6+LNEKaajXi8s/CgBzzlSFAN7RgqkEcftEYvAhD9hTD04AN08Mo0/3ihASwEl+MPEEN7wBxK8kQPH/U9zWjiDP0o3BAngihXcK0HWNpEDUuhDCVv4RB2I8YM8xANwElBfAR52B1iIAQkZERzhWrEGTOBvCWtggON8wIAALkIMd3DcCxiguRH0r3QF8IEr/9ZAif4BgBP72Acd3AACJRRBEHWwww/EEYFxbKEJY/jGI6JACFJUYB9tQIIJ6DAFLKDAHxfwBxvw8TgFuIICDpgeGFKwuRY0IxVqlIUP/CGDNKZxBLKgQACecAJMOKAFFfgiE534CTs4Yx6r+MYJ/pDFBIShCISYQjPoEEYTJKACbTjjCQCHkRRIzx8ngJYE6EgJO04BWgrYYyr86A8UoNAffUgFPmSwSTossYlP1MU9sGCJYhqTEoLYQiY32YxJVoAOd7wAHWZ5gQvIgA7VXEUf/9DHKTzTDdvs4yqmYM0LpOIE2ZQBK3jpy1+aIgq3IAQZUkGJetZTBXy4RTw16W/LFiSgnW74pz8TkIBmVICgdPDnDZrxyXYqlKFuCChEB2rQhvpyHy2QhSkCEIUitKMWIA1pR4sQBT6Qgg5JTKlKV8rSlrL0oi5VaUL1oQNXmEIUSsipTnea02Po46dADapQh0pUooKgqEMFgSyaFRAAOw==') no-repeat 0 0; }", 
          ".tf-logo { width:48px; height:33px; -moz-border-radius:0 !important; -webkit-border-radius:0 !important; border-radius:0 !important; background: @link url('data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAhCAYAAACfiCi5AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2RpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2RjFCMDk3MkM3OUFFMDExOTFGREJBRDY5RjdFM0NDQiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFNTM0MTE4MDlGMTAxMUUwOEQyNUYyQUNFN0UzMkE1QiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFNTM0MTE3RjlGMTAxMUUwOEQyNUYyQUNFN0UzMkE1QiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3MiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo3MDFCMDk3MkM3OUFFMDExOTFGREJBRDY5RjdFM0NDQiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo2RjFCMDk3MkM3OUFFMDExOTFGREJBRDY5RjdFM0NDQiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PnS9gtwAAATPSURBVHja7JhbaBRnFMe/SbKb3Wyym2Q3S5MSi/XW4gWLta22FGvBNkhflOKD+CKKL5UKQvsi+CBKL9QXsQj23jcf2lJolYI+CNJCpSCtIoSIa811L7lubptk/P/H8y3DOjuZvaAIOfBjNjPffHP+53znzDcxTJh6iq1GPeW2JGBJQIVWV+T8ELgOVoPngO8J+pgCtyXYW70KuAN2ggBYDjaCV+S4Ejzjcm8lNgruglvgbwkinU+CXU4CjCJtdBy8CHodrjWBZZKdl8A28HqZyzEBroA/xWkGbhAsOIw9Dw48ctYsbieozSNbwB+md0uBwyDicf5OMOw0kZuALHirBBHM5kkPzt8EL5Qwrx/8VmwytcjDxsCHoLGEB37rMl8GrCkxs9fcHHQVkMvl9M/b4Ch41sND4yBZZMqPPdzvA13gki2ImbIE9PX1mb29vebY2Jg5NzfHU2lwAexaZP1+4TAdRcVc7tkIPgd3Zfx1cAhEwe9lCchkMmZ3d7fZ09NjJhIJc2hoyJycnDQXFhZ4OQHOgk0OzrwM5gum+85hXFiK+YaMuQ9Oixg9JiaBczTDbTc6Pz+vkAWF6OuOpQzDUD6fTzU0NKjGxkbl9/tzuPQNOCYvHZof/CutVtsecMH2917wGYiBX8D34DKYKXDjDPigmI/GYttpRFwNDg4+HAzntRBSU1OjAoGAam5u5vEmLnWB/+XWH8A++U2n1oIe+fsTcAR8Cr6y3VNo74GfQW3ZeyFGOh6PW85j6eSF0HktcGBgQGWz2bXijJ7zhm2aezYn+Ub9COwAx12cfxf86Oa8JwFcRvX19aqjo0OFQqG8EKKzwGMqlVLoWjvEMVp3wdZkVvZUp8BhcLXII1dxDOb/dXZ2NlLuZi5vXP/9/f0qHA6rWCxmnZuamsrD6xRFocPDw8zWfgy5JNsQLk9DMkDbLnVy1r6MZZ/1DngbbJ6YmAhyLgaO2a9IACch6EgKE1tCWLyEkec5tFk1MzNjLSdE7Q0UdkD2NNMgaCtu1sg5PbXUyEEKYEYZkPHxcWseWltbm6o4A7SWlhY1PT1tRZlCRkZGLFEUwWXV1NRkRT+dTlNQe2trK3et/4CJAgFh8JMU9NcIwKucl0HgUXc7Gudmg6iKAN1p6KTuRHwgI0ZBFEGRNDqD369h3F+yPWYYB0BUWmsIXESkO5k5ZCzfnnV9IYMKQajog8YxC7W1tVb0daT0A0dHRy0xTDmXEtgs0RuR2/vACvAfnP0ymUx2Umhha6YxGNFoVNXV1VVXgJV/rH8+gM4yA+g6lhjCSOJNbUUOTq2XWzK2Lzyeex/dajcjz+7FgNBRvhgZ9WAwaC3NanxSFjU+VBcxhdjfB8wEnWtvb38ep5rFcS3kTVyznOe9DAadZ11pEdX8JlZe2ivf0PptzOhxCbFOsMxCWHJrMKyfQ1kyGL+BApkhRlnXEI88p2vosQlg1FjYLGJGlTCKkUhE18Y6iKOANJsK6mIVo85M8R5duBTPLlbt/0p4MtkD5V9orAlmgOfh/Cb5KGcHWg7BcTrOoucSYgCYCW5V9DJ87AJ0i7X3a4php0KX2QJHuYXIwumtEGbQcWaoEodL3o1WUCM5RJlLiHv+SYjoYAOothlL/51eElCZPRBgAI9K4+Nl7F3ZAAAAAElFTkSuQmCC') no-repeat 0 0; }", 
          "#tf.busy .tf-logo { background-image:url('data:image/gif;base64,R0lGODlhMAAhANUAAP7+/t3d3fz8/N7e3v39/eDg4OLi4u3t7eHh4fDw8Pj4+Obm5ujo6Pv7++7u7urq6unp6ePj4/r6+vLy8uXl5fb29ufn5/Pz8/f39/n5+fT09O/v79zc3OTk5Ovr6/Hx8ezs7Nvb2/X19dra2t/f3////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkI4QUUzODFCOUY1MDExRTA4MTYzQUIyOTgzRjM0MTRBIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkI4QUUzODFDOUY1MDExRTA4MTYzQUIyOTgzRjM0MTRBIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6QjhBRTM4MTk5RjUwMTFFMDgxNjNBQjI5ODNGMzQxNEEiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6QjhBRTM4MUE5RjUwMTFFMDgxNjNBQjI5ODNGMzQxNEEiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4B//79/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHQz87NzMvKycjHxsXEw8LBwL++vby7urm4t7a1tLOysbCvrq2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZmVkY2JhYF9eXVxbWllYV1ZVVFNSUVBPTk1MS0pJSEdGRURDQkFAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAAAh+QQEAAAAACwAAAAAMAAhAAAG/8CScEgsGo/IpHLJbDqf0Kh0Sq06BRUJwJoUYBRKBanQeXwwjS2VkNEcLAYSREmIk+4kRAeywTgbFyALdngkE0sbhYokCxV0BwiLeBEESwAWkoUJSBIdmXcFjkwEkJ8kF0YEnp8LYE0NJRIHhIoGAkUOmQUMjgSVTAsUEwIEGhCRih9EArR3FAmwGSAIoksOIQEIDxUADRMUhQtEF4UIBxklAh/gJAa/S8wDAwEDEecAE3YFEkMPeA8CAGhgUKCQMici5N2ZR8ICBgkR7qAqASAiiQQANlgsNAeKBhIBCoXUUOHOASESCs7BtIjBuyYCGmQgGIAeiQH7GMgRUnIfiP9FHRIIQPdEzAEBAi48QEAvAISPFIRMIMFADJ4FfQBcMNDxyYIQCDbAwtchZIUCEbYkIPHBwxgQYIpZqOkHCgZ5IRdMqHTtwIICtw6cIqMAQIUHBvB2heLA5rwCHgQ4MCCY39JZ3jrMGwAyAqwpH5jSG8DBAAYLicBYWMDAWM159Bh8ppLUwyDSCC58dFRGxANsZPi44sJTgYJcFAjkLmFgwgcOFkRkyEKcSIM8ECZoiOBgAUYEGgw4EHGgAwcH1YlsCBAiRIENCTwcjTAhwQIOITh0mJ2+BAYHD1AwgAMTeJCBBQoYsAsIF7zUHxEVYOWAAm844OCDnDRAQAO3YOgH4YcghphEEAAh+QQEAAAAACwFAAAAJgAhAAAG/8CSUAgYGo/IpNJYXDqfyCZ06pRSr0crdktQSLbGTAZKgJAsiYx22ZhYSI7pgUQnRR6atVCQWBTqF1MVf3V0DAJIGRGFJAhfT0UMjHQWBEYCFJMeU0UNC5MkCUYbkwuIUEUCBBuEdR1NAJmFIACWqCUMDw0SIK0FGEIZhQsKACCbtyAjCBsEEg91oiUXdAgTJSKL0pAlCiQBAQgJAAl0D0VzCAoCko1jtyUQHCQDAREYDmeIZhcarRBUmjQwEIBOAAMKDESQQIACBQytELy7BUCAAgrgvh3woG7gARB1EGhoEFDIgwcEKjAYwMHABBIYFCVYxEzAAYCchFwIQWEMhrwIHD6QEKFgwRwIAgR4CHEtZwkBBjgMYCABgAEILjEsYMCAwAeCBR7BK7Fh3oABDiosoJCgAgULFSwEqIfMqRAP4FgeOMDAgYYOGxhwCMCBwim7JQCIeBABXAIQBy4w+DBvQQJbJY8IwIDB4QcPHxxQYKCg2JY1FwbgMeohAd8LHSJgznwpwogAIBK0TvCAQ4g4p5NIcGChwITcHwpYmKCH2xIREBxMeCACzJDmQ5w1mA0Gu/Ul3r8nCS8+CAA7'); }",
          ".tf-symbol { background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2RpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2RjFCMDk3MkM3OUFFMDExOTFGREJBRDY5RjdFM0NDQiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo1MEI3NDNERDlGMTQxMUUwOUIwQUZCRDZBQ0Y3NTMyNSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo1MEI3NDNEQzlGMTQxMUUwOUIwQUZCRDZBQ0Y3NTMyNSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3MiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo0RjA4QUI0OTE0OUZFMDExOTFGREJBRDY5RjdFM0NDQiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo2RjFCMDk3MkM3OUFFMDExOTFGREJBRDY5RjdFM0NDQiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PuNkwaAAAAF1SURBVHjaxJIxSMNQEIbv2TQpadqmEOjqYAcXh4KLs0txcHMRBBcHESc3BTdxEmdnZ0Vwc3FzEYQKbmIHM1hI0wTapk3a+N/jVayDQx08+Ai5d/9/944nUgTNGHP0h9DALdDBEqgA8Ut9At7Bk6zF1Ec8ObBADeyDt3Q6HsAmWAS6qr+m8XgcgUP8VFSSqYKWEj4C89vZMjgHMcVxnLqum7bb7dZwOLxEclUVnSnxhuq2DU7BjpoiEnwaBAFBLJ3z+Tw5jrObyWReca8bUANroAHugAGuQF1uO5vNUqFQINu2Cd3Z6JjT4AUsgHvgjkajE9/3G4PBoD7ZthT3+30SQpBpmryHSpIkVU3Tmjjm62x1Op29Xq8ndF2nUqkkVy8mjwSuFIahNMHIVC6XL1AY8iSe5x1wmWVZckJuMvVIWMCO6CaNsMh5pL1ut7vOwlwuR8Vi8Us41XkS/Mvd8P0wDOM5iqIVGJp8tZ8h/vVt+7OKPwUYAK0xGiXURoQhAAAAAElFTkSuQmCC') !important; background-repeat:no-repeat !important; background-position:center; }",
          '#tf a[data-option] { cursor:pointer; }',
          '#tf.minimized { height: 70px; }',
          '#tf.minimized #tf-stream-nav { width: 60px; }', //webkit fix
          '#tf #tf-stream-nav a.layout { display:none; }',
          '#tf.minimized #tf-stream-nav a.layout { display:block; }',
          '#tf-stream-nav { float:left; background:#fff; '+this.css3shadow('2px', 'rgba(0, 0, 0, 0.1)', '-1px', '-1px')+' border:1px solid #bbb; border-color: #bbb #fff #bbb #bbb; border-style: solid none solid solid; float: left; margin: -1px 0 0 -21px;  }',
          '#tf-stream-nav a { display:block; width:20px; height:20px; text-indent:-50px; overflow:hidden; position:relative; }',
          '#tf-stream-nav a i { display:block; width:0; height:0; border: 5px solid #fff; position:absolute; left: 4px; }',
          '#tf-stream-nav a b { display:block; width:4px; height:4px; background:@link; position:absolute; left: 7px; }',
          '#tf-stream-nav a.bottom i { border-top-color:@link; bottom:0; }',
          '#tf-stream-nav a.bottom b { bottom: 10px; }',
          '#tf-stream-nav a.top i { border-bottom-color:@link; top:0; }',
          '#tf-stream-nav a.top b { top: 10px; }',
          '#tf-stream-nav a.layout i { border:0; width: 15px; height:13px; background-color:#666; background-position:0 0; left:2px; top:3px; }',
          '#tf-stream-nav a.layout:hover i { background-color:@link;  }',
          
          
          '#tf ul.tf-filters { overflow:hidden; list-style:none; margin:0; padding:0; }',
          '#tf ul.tf-filters > li { float:left; padding:3px; margin:0; width:48px; border-right:1px solid #ebebeb; }',
          '#tf ul.tf-filters > li.invert { border-right:0; min-width:48px; }',
          '#tf ul.tf-filters > li.filter { float:right; }',
          '#tf ul.tf-filters a[data-option] { color: @link; text-transform:lowercase; display:block; text-decoration:none !important; '+this.css3rounded('2px')+' }',
          '#tf ul.tf-filters a[data-option="filter-inverted"] { color: @lighttext; background:#f5f5f5; }',
          '#tf ul.tf-filters a[data-option] > i { font-style:normal; color:@lighttext; font-size:11px; display:block; text-align:center; }',
          '#tf ul.tf-filters a[data-option] > b { font-weight:normal; font-size:11px; display:block; text-align:center; color:@link; }',
          '#tf ul.tf-filters a[data-option].checked { background: #f5f5f5; text-decoration: none; }',
          '#tf ul.tf-filters a[data-option="filter-inverted"].checked { background: @link:0.2 !important; color:@link !important; }',
          '#tf ul.tf-filters a[data-option="filter-inverted"].checked > i { color:@link; text-shadow:0 1px 0 #fff; }',
          '#tf ul.tf-filters li.disabled [data-option="filter-inverted"].checked > i, ',
          '#tf ul.tf-filters a[data-option].checked > b { color:#999 !important; }',
          '#tf ul.tf-filters a[data-option="filter-inverted"].checked > b { color:@link !important; text-shadow:0 1px 0 #fff;  }',

          '#tf ul.tf-filters li.disabled a[data-option],',
          '#tf ul.checks li.disabled a[data-option],',
          '#tf.inverted ul.tf-filters li.disabled a[data-option] { background: transparent !important; color:#999 !important; text-shadow:none !important; }',
          '#tf ul.tf-filters li.disabled a[data-option] > b,',
          '#tf ul.checks li.disabled a[data-option] > b,',
          '#tf.inverted ul.tf-filters li.disabled a[data-option] > b { color:#aaa !important; }',
          
          '#tf ul.tf-filters a[data-option].exclusive { background: @link:0.2 !important; color:@link !important; }',
          '#tf ul.tf-filters a[data-option].exclusive > i { color:@link !important; text-shadow:0 1px 0 #fff; }',
          '#tf ul.tf-filters a[data-option].exclusive > b { color:@link !important;  text-shadow:0 1px 0 #fff; }',
          
          /* inverted - passed switch and filter states when inverted */
          '#tf.inverted ul.tf-filters li.filter a[data-option] { background: #f5f5f5; }',
          '#tf.inverted ul.tf-filters li.filter a[data-option] > b { color:#999; }',
          '#tf.inverted ul.tf-filters li.filter a[data-option].checked { background: #fff; }',
          '#tf.inverted ul.tf-filters li.filter a[data-option].checked > b { color:@link !important; }',

          '#tf ul.tf-filters > li > a.stream-nav { float:left; background:#fff; margin-left:-22px; width: 12px; height:12px; }',

          '#tf .tf-stream { margin: 4px 10px 0 10px; border-bottom:1px solid #fff; }',
          '#tf .tf-stream > ul.checks > li { float:right; }',
          '#tf .tf-stream > ul.checks > li:first-child { float:left; }',
          '#tf .tf-stream > ul.checks > li.disable { width:65px; }',
          '#tf .tf-stream > ul.checks > li.disable > a { margin-top:2px; }',
          '#tf .tf-stream > ul.checks > li.streamtitle > span { display:inline; margin:0; position:static; }',
          '#tf .tf-stream > ul.checks > li.streamtitle > i { font-style:normal; color:@link; }',
          
          '#tf-customize { position:relative; }',
          '#tf .tf-stream > p > span { color:@darktext; }',
          '#tf input[type=text] { border:1px solid #a7a7a7; padding:2px; color:#a7a7a7; font-size:11px; margin-right:6px; }',
          '#tf .tf-stream input { float:right; }',
          '#tf p.tf-version { position:absolute; top:9px; right:20px; font-size:10px; padding:0; }',
          '#tf p.tf-version a {  color:#999;  }',
          '#tf p.tf-version a:hover { color:@link; text-decoration:none;  }',        
          
          '#tf ul.tf-tabs { list-style:none; overflow:visible; background:#f5f5f5; border-top:1px solid #eee; height:20px; padding:5px 5px 0; margin:5px 10px; border-bottom:1px solid #eee; }',
          '#tf ul.tf-tabs li.tf-tab { float:left; cursor:pointer; border:1px solid transparent; border-bottom-color:#eee; text-align:center; height:19px; font-size:12px; line-height:19px; }',
          '#tf ul.tf-tabs li.tf-tab a { text-decoration:none; color:@link; padding:0 8px; text-shadow:0 1px 0 #fff; }',
          '#tf ul.tf-tabs li.tf-tab:hover { background:#eee; }',
          '#tf ul.tf-tabs li.tf-tab.active { background: #fff; border-color:#eee; border-bottom-color:#fff; '+this.css3rounded('2px 2px 0 0')+' }',
          '#tf ul.tf-tabs li.tf-tab.active a { color: @darktext; font-weight:bold; }',
          '#tf ul.tf-tabs li.addtofilter { float:right; margin:-2px 0 0 0; padding-right:5px; position:relative; }',
          '#tf ul.tf-tabs li.addtofilter a { font-size:11px; }',
          '#tf ul.tf-tabs li.addtofilter a:hover { color:@link !important; }',
          '#tf-filter-add { border:1px solid @lighttext; color:@lighttext; width: 160px; }',
          '#tf-filter-add.active { border-color: @darktext; color:@darktext !important; border-color:@link !important; '+this.css3shadow('3px', '@link')+' }',
     
          '#tf div[data-tab] { display:none; }',
          '#tf div[data-tab].active { display:block !important; }',
          '#tf div[data-tab] fieldset { border:1px solid @lighttext; '+this.css3rounded('3px')+' padding:0 5px 5px 5px; margin:5px 0; }',
          '#tf div[data-tab] label { padding:0 5px; }',
          
          '#tf-customize > div { display:none; padding:5px 12px; }',
          '#tf-customize > div.active { display:block; }',
          
          '#tf ul.checks { list-style:none; margin:0; padding: 0; overflow:hidden; }',
          '#tf ul.checks > li { cursor:pointer; float:left; height:20px; padding:0; margin:0; position:relative; }',

          '#tf ul.checks > li > span { display:block; margin:1px 5px; height:16px; position:relative; }',
          "#tf ul.checks > li a { color:@lighttext; font-size:12px; display:block; overflow:hidden; white-space:nowrap; height:16px; line-height:16px; text-decoration:none; text-indent:16px; margin:0; position:absolute; left:0; top:0; right:10px; text-align:left; }",
          "#tf ul.checks > li a > b { background:#fff; "+this.css3shadow('2px', '#a7a7a7 inset')+" "+this.css3shadow('2px', '#a7a7a7')+" display:block; position:absolute; height: 8px; bottom:4px; left: 3px; width: 8px; }",   /* check box */       
          "#tf ul.checks > li a:hover { color: @darktext; }",
          "#tf ul.checks > li a:hover > b { "+this.css3shadow('4px', '@link')+" } ",
          "#tf ul.checks > li a.checked { color: @darktext; }",
          "#tf ul.checks > li a.checked > b { background:@link; position:absolute; border: 0; height: 8px; bottom:4px; left: 3px; width: 8px; }",   /* check box */   
          '#tf ul.checks > li.disabled a.checked > b { background: #fff; }',
          
          "#tf ul.checks > li a > i { color:@link; font-weight:normal !important; font-size:9px; height:16px; right:0; text-indent:0; top:0; position:absolute; background:#fff; padding-right:2px; }",    /* match count */      
          
          '#tf .tf-queries { width: 100%; padding-top: 5px; }',
          '#tf .tf-queries > li { width:50%; }',
          "#tf .tf-queries > li > span > a.x { left:auto; text-indent:0; color: #999999; font-size: 9px; line-height: 16px; position: absolute; right: 0; top: 0; vertical-align: top; width: 10px; text-align:center; }",         
          '#tf .tf-queries > li > span > a.x:hover { color:@darktext; text-decoration:none; }',
          '#tf .tf-queries > li.user > span > a:first-child { font-weight:bold; }',
          '#tf .tf-queries > li.via > span > a:first-child { font-style:italic; }',
          '#tf .tf-queries > li.exclusive a > span { border-bottom:2px solid @link; color:@link !important; font-weight:bold !important; }',
          "#tf .tf-queries > li:hover > span, .tf-queries > li:hover > span > a > i  { background:#f5f5f5 !important; } ",
          "#tf .tf-queries > li.notfound a.checked > b { background: #aaa; }",
          "#tf .tf-queries > li.notfound a > i { display:none; }",
          "#tf .tf-queries > li.notfound > span > a:first-child > span { color: @lighttext !important; }",

          '#tf-customize ul.checks { list-style:none; padding:0; margin:0; overflow:hidden;}',
          '#tf-customize ul.checks > li { padding:0; margin:0; width:50%; }',
          '#tf-customize ul.checks > li > a { color: @darktext !important; }',
          '#tf-customize ul.checks > li > a:hover { color: @link !important; }',
          '#tf-customize ul.checks > li > a > b { '+this.css3shadow('2px', '@darktext')+' }',
          
          '#tf-export-settings { cursor:move; border:1px solid #eee; border-left:3px solid @link; '+this.css3shadow('2px', '@darktext')+' left:auto !important; right:auto !important; padding-left:5px; text-indent:0 !important; padding-right:5px; }',
          
          '#tf div.about { padding: 10px 0 0 0; overflow:hidden; border-top:1px solid #eee; margin-top: 10px; }',
          '#tf div.about ul li { float:right; margin-left: 8px; font-size: 11px; }',
          '#tf div.about ul li.version { float:left; margin-left:0; }',
          '#tf div.about ul li a { color:@link; text-decoration:none; }',
          '#tf div.about ul li a.tweet { display:inline-block; height:15px; width:42px; overflow:hidden; text-indent:-100px; }',
          '#tf div.about ul li a:hover { text-decoration:underline; }',
          '#tf div.support { display:none; }',
          '#tf-scroll { margin:5px 10px; overflow:auto; max-height:160px; display:none; }',
          
          '.stream-title h2 em { color: @link; font-style:normal; }',
          '.stream-title h2 div.tf { font-size: 80%; clear:left; }',
          '.stream-title h2 div.tf span.user { font-weight: bold; }',
          '.stream-title h2 div.tf span.via { font-style: italic; }',
          '#tf.minimized { height: 20px; width: 40px !important; min-width: 40px; }',
          '#tf.minimized > div, #tf.minimized ul.tf-filters, #tf.minimized ul.tf-tabs { display: none; }',
          '#tf.minimized > div.tf-header { display: block; height: auto; }',
          '#tf.minimized #tf-stream-nav a.top { left: 0; top: 0; }',
          '#tf.minimized #tf-stream-nav > a { float: left; top: 0; }',


          /* small twitter layout fixes */
          'div.tweet-activity { width:100%; }',
          '.stream-tab.stream-tab-title { z-index:1; }',
          '.stream-title h2 { position:relative }',
          '.stream-title .go-to-list-page { position:absolute; top: 1em; right:1em; }', //assure we see "view list page" link in exclusive filter mode
          /* add to filter menu */
          '.tweet-actions { position:absolute; right:-5px; bottom:-5px; }',
          '.tweet-actions a span b { display:none; }',
          '.tweet-actions a.tf span b { display:none; }',
          '.tweet-actions a.tf.dm span i { background-position:2px -30px; }',
          '.tweet-actions a.tf.dm:hover span i { background-position:-13px -30px; }',
          '.tweet-actions a.tf.quote span i { background-position:2px -15px; }',
          '.tweet-actions a.tf.quote:hover span i { background-position:-13px -15px; }',
          '.tweet-actions a.tf.menu span i { background-position:-15px 1px; }',
          '.tweet-actions a.tf.menu:hover span i { background-position:-30px 1px; }',
          
          '.main-content ul.tf-menu { display:block; width:auto !important; position:absolute; top: 12px; right:0; }',
          '.main-content ul.tf-menu li { font-size:11px; padding:3px 8px; white-space:nowrap; overflow:hidden; }',
          '.main-content ul.tf-menu li.user a { font-weight:bold; }',
          '.main-content ul.tf-menu li.source a { font-style:italic; }',
          '.main-content ul.tf-menu li.selection a { display:inline-block; margin-left:3px; }',
          '.main-content ul.tf-menu li.selection i { color:@lighttext; font-weight:bold; }',
          '.main-content ul.tf-menu li.selection:hover { background:transparent; }',
          '.main-content ul.tf-menu li.selection:hover a { color:@link; }',
          
          '.main-content ul.tf-menu.drop-down { max-width:200px !important; }',
          '.main-content ul.tf-menu.drop-down li a { max-width:180px; overflow:ellipsis; }',
           /* via link */ 
          '.stream-item .tf-via { display:none; }',
          'body.expand-last div.latest-tweet .tweet-row { height: 4em; }',
          'body.tf-filter-inverted li.stream-tab.active a.tab-text { color:#999 !important; text-decoration:line-through; }',
          'body.tf-show-via .stream-item .tf-via { display:inline; font-size:11px; color:@lighttext !important; }',
          'body.tf-show-via .stream-item .tf-via a { color:@lighttext !important; }',
          'body.tf-show-via .stream-item .tf-via a:hover { color:@link !important; }',
          /* body class enabled layout options */
          'body.tf-expand-new div#new-tweets-bar, body.tf-expand-new div.new-tweets-bar { display:none !important; }',
          '.tweet-text br { display:none; }',
          'body.tf-show-br .tweet-text br { display:block; }',
          'body.tf-small-links a.twitter-timeline-link { font-size:12px;  line-height:14px; display:inline-block; max-width:440px; overflow:hidden; vertical-align:bottom; }',
          'body.tf-small-links div.tweet-text-large a.twitter-timeline-link { max-width:430px; }',
          '.main-content .stream-item .tweet-source { display:none; }',
          'body.tf-show-via .main-content .stream-item .tweet-source { display:inline; }',
          'body.tf-compact-activities div.dashboard ul.inline-list,',
          'body.tf-compact-activities div.dashboard div.latest-favorite,',
          'body.tf-compact-activities div.dashboard div.recently-listed-in { display:none; }',
          'body.tf-compact-activities div.dashboard div.your-activity { height:auto !important; margin-bottom:0;}',
          'body.tf-hide-topbar { background-position: top left !important; }',
          'body.tf-hide-topbar div#top-stuff { top: -30px; height:40px; }',
          'body.tf-hide-topbar div#top-bar-bg,',
          'body.tf-hide-topbar div#top-bar { visibility:hidden;  }',
          'body.tf-hide-topbar div#top-stuff[data-over="0"][data-focused="0"] #global-nav li.active a { background:rgba(0,0,0,0); }',
          'body.tf-hide-topbar div#top-stuff[data-over="0"][data-focused="0"] #message-drawer .message { margin-top:-15px; }',
          'body.tf-hide-topbar div#top-stuff[data-over="1"],',
          'body.tf-hide-topbar div#top-stuff[data-focused="1"] { top: 0; }',
          'body.tf-hide-topbar div#top-stuff[data-over="1"] div#top-bar-bg,',
          'body.tf-hide-topbar div#top-stuff[data-over="1"] div#top-bar,',
          'body.tf-hide-topbar div#top-stuff[data-focused="1"] div#top-bar-bg,',
          'body.tf-hide-topbar div#top-stuff[data-focused="1"] div#top-bar { visibility:visible; }',
          'body.tf-hide-topbar div#page-outer { padding-top: 25px; }',
          'body.tf-hide-topbar div#details-pane-outer { margin-top:0 !important; top: 25px !important; }',
          'body.tf-fixed-dashboard div.dashboard { position:fixed; margin-left:540px;  width: 340px;  }',
          'body.tf-hide-trends div.dashboard > div.component.trends { display:none; }',
          'body.tf-hide-wtf div.dashboard > div.component.wtf { display:none; }',
          'body.tf-hide-ad div.dashboard > div.component.ad { display:none; }',
          'body.tf-minify-menu div.footer.inline-list li { display:none }',
          'body.tf-minify-menu div.footer.inline-list li:nth-child(5),',
          'body.tf-minify-menu div.footer.inline-list li:nth-child(9),',
          'body.tf-minify-menu div.footer.inline-list li:nth-child(15) { display:inline }',
          'body.tf-expand-last div.latest-tweet.ellipsify-container > span.content { height:auto; white-space:wrap; }',
          'body.tf-expand-last div.latest-tweet .ellip { display:none; }',
          'body.tf-expand-last div.latest-tweet .tweet-row { height:auto; white-space:wrap; }',
          'body.tf-expand-last .ellipsify-container > span.content { overflow:visible; white-space:normal; display:block; }',
          'body.tf-hide-question div.tweet-box-title { display:none; }',
          'body.tf-hide-tweetbox div.main-tweet-box { display:none; }',
          'body.tf-hide-tweetbox div.page-header { padding-top:4px; }',
          'body.tf-hide-tweetbox div.page-header ul.stream-tabs { margin-top:5px; }',
          '.tweet-corner i.tfu { margin-left:-3px; }',
          'i.tfu { display:none; }',
          "body.tf-show-friends i.tfu { background-repeat:no-repeat; display:inline-block; height:13px; width:1px; background-position:0 -60px; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAxCAYAAADukUiUAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyBpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkE0M0U2Mzc3QTg0MDExRTBCOTEzQjM0NTFFRTMzN0NEIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkE0M0U2Mzc4QTg0MDExRTBCOTEzQjM0NTFFRTMzN0NEIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6QTQzRTYzNzVBODQwMTFFMEI5MTNCMzQ1MUVFMzM3Q0QiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6QTQzRTYzNzZBODQwMTFFMEI5MTNCMzQ1MUVFMzM3Q0QiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6xg46LAAADfUlEQVR42uyWT0gUURzH35/ZnVVnt0xyddR0if5cgog0F5IoKiiiP5dE8GZodDDoEkhQxzpEeI6oYyB0sYu3giKCjlYQCWq0qLlm7t9xZmf6/mbfyGx2sFsHH3x4w+/9fu/3/c3bN7/lExMTzPM8xjn3ZxqYBzE1gXGyh9eEcmBSShaJRJjjOEZLS8u9jo6OsUqlYmqaxoiagGDQAoKGW1tb9yKoWdf10bCz7wMS4IoQ4jgcUo2NjT2UiWSYpnkzl8t1F4vFb/B5B95QQByL15PJZK9hGL5jPp/3d4vH4zHYTiGAzc/PpyFxgQK+I+VAJpN5jqBj0Wh0QwIF27bNFhcXp13X7YeKT5pamMXCUDabnUwkEqlwXci2hLUb8PkU1BDstoqUVqFQCPtTBhvTykbRlFYFtCHt/nK5TJIyMFmwUbY2SOnC/NF/raRX0QAoy13MadCHDW5hXgGJwE8LZf8CLmLX98AhAwIe4fltWBIPH8pWhmD/OLYDtjL8gxsZGfnTfhlcAtdAhQzrjmT7ktm/ZiDbWUCnnd6KpAtgBjxWWeo2ScIYAEfU4g5wGyyB0+CherbA0yAgpT4rY+AXKCn7fRAD58EoBQSSaJcFJccOKXBBJzipXsBCEEDpHoADinCNw+Cl+vnXFE07ryk5cdChMvxQ9pqimSrWAIfAYWCqt1VWNb7FPa4JoGy9oAheqF3PgH4wpT66NQF5VTxdyayyPQGfwc/tK/qfXdHS605WtjXGBTqlG5yJO8g83sQ4G8dRVdfovLyNDGi7Wj0TEYN5TsGI7u67p5vnxjynaHJZx3ikAS7uH5Jg4Bp6XDQxrCdP7NWTfc0i1jTKo4b/G9rURbnUjovojlS06WCPVk83lbM688RNe22u27VsdFEedFEvDpHX68x0byRBV0DimzLn69V3dcb0Xe2nnMIiy81MpT2ntMCLr/aw0rroklrsudF59Jis34maK+odSuZaeZaf+zDtWLl+zmXQRcWss14aKi9PTza0tKeQcUO3tZxZckq5G1xK1UW5Lxc+cpV7JYs589WLyarqkMJmQqwwHnRRUX3PCGmTWmm/U8yz8lokgxosPe6kZIS3caF3ceH5XVSjw/IPDF3UyslV95cY9yryGX1THYtfFYLdgUNCHQPzi6aTpn6MKrsQ/h4Jq12U/kcx0YMn6qJfyfZbgAEAfjx5x2g3QsAAAAAASUVORK5CYII=') }",
        ].join("\n");
        this.refreshcolors();
        var that=this;
        style = style.replace(/@([a-z]+)\:([10]\.[0-9]+)/g, function(match, color, alpha) {            //! alpha=1 is ignored, use 1.0
          return twttr.helpers.hexToRGBA(that.colors[color], alpha);
        });
        for (var color in this.colors) {
          style = style.split('@'+color).join(this.colors[color]);
        }
        this.setcss(name, style);
        this.widget.removeAttr('style');
        break;
      }
    }
    return true;
  };
  
  // Color manipulation functions
  // Source: http://stackoverflow.com/questions/1507931/generate-lighter-darker-color-in-css-using-javascript
  
  Tweetfilter.prototype.zero_pad = function(num, totalChars) {
      var pad = '0';
      num = num + '';
      while (num.length < totalChars) {
          num = pad + num;
      }
      return num;
  };
  // Ratio is between 0 and 1
  Tweetfilter.prototype._changecolor = function(color, ratio, darker) {
      // Trim trailing/leading whitespace
      color = color.replace(/^\s*|\s*$/, '');

      // Expand three-digit hex
      color = color.replace(
          /^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i,
          '#$1$1$2$2$3$3'
      );

      // Calculate ratio
      var difference = Math.round(ratio * 256) * (darker ? -1 : 1),
        // Determine if input is RGB(A)
        rgb = color.match(new RegExp('^rgba?\\(\\s*' +
            '(\\d|[1-9]\\d|1\\d{2}|2[0-4][0-9]|25[0-5])' +
            '\\s*,\\s*' +
            '(\\d|[1-9]\\d|1\\d{2}|2[0-4][0-9]|25[0-5])' +
            '\\s*,\\s*' +
            '(\\d|[1-9]\\d|1\\d{2}|2[0-4][0-9]|25[0-5])' +
            '(?:\\s*,\\s*' +
            '(0|1|0?\\.\\d+))?' +
            '\\s*\\)$'
        , 'i')),
        alpha = !!rgb && rgb[4] != null ? rgb[4] : null,

        // Convert hex to decimal
        decimal = !!rgb? [rgb[1], rgb[2], rgb[3]] : color.replace(
            /^#?([a-f0-9][a-f0-9])([a-f0-9][a-f0-9])([a-f0-9][a-f0-9])/i,
            function() {
                return parseInt(arguments[1], 16) + ',' +
                    parseInt(arguments[2], 16) + ',' +
                    parseInt(arguments[3], 16);
            }
        ).split(/,/);

      // Return RGB(A)
      return !!rgb ?
        'rgb' + (alpha !== null ? 'a' : '') + '(' +
            Math[darker ? 'max' : 'min'](
                parseInt(decimal[0], 10) + difference, darker ? 0 : 255
            ) + ', ' +
            Math[darker ? 'max' : 'min'](
                parseInt(decimal[1], 10) + difference, darker ? 0 : 255
            ) + ', ' +
            Math[darker ? 'max' : 'min'](
                parseInt(decimal[2], 10) + difference, darker ? 0 : 255
            ) +
            (alpha !== null ? ', ' + alpha : '') +
            ')' :
        // Return hex
        [
            '#',
            this.zero_pad(Math[darker ? 'max' : 'min'](
                parseInt(decimal[0], 10) + difference, darker ? 0 : 255
            ).toString(16), 2),
            this.zero_pad(Math[darker ? 'max' : 'min'](
                parseInt(decimal[1], 10) + difference, darker ? 0 : 255
            ).toString(16), 2),
            this.zero_pad(Math[darker ? 'max' : 'min'](
                parseInt(decimal[2], 10) + difference, darker ? 0 : 255
            ).toString(16), 2)
        ].join('');
  };
  
  Tweetfilter.prototype.lighten = function(color, ratio) {
    return this._changecolor(color, ratio, false);
  };
  
  Tweetfilter.prototype.darken = function(color, ratio) {
    return this._changecolor(color, ratio, true);
  };
  
  
  //get json value from local storage with default
  Tweetfilter.prototype.getvalue = function(name, defaultvalue) {
    var value = localStorage.getItem(name);
    try {
      return typeof value === 'string' && value.length ? JSON.parse(value) : defaultvalue;
    } catch (e) {
      return defaultvalue;
    }
  };

  //set json value in local storage
  Tweetfilter.prototype.setvalue = function(name, value) {
    if (value === null) {
      localStorage.removeItem(name);
      return null;
    } else {
      localStorage.setItem(name, JSON.stringify(value));
      return this.getvalue(name);
    }
    return false;
  };

  //encode special html characters
  Tweetfilter.prototype.encodehtml = function(str) {
    if (typeof str === "string") {
      str = str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    return str;
  };

  //decode html source
  Tweetfilter.prototype.decodehtml = function(str) {
    if (typeof str === "string") {
      str = str.replace(/&gt;/ig, ">").replace(/&lt;/ig, "<").replace(/&#039;/g, "'").replace(/&quot;/ig, '"').replace(/&amp;/ig, '&');
    }
    return str;
  };
  
  Tweetfilter.prototype.inarray = function (needle, haystack) {
    var len = haystack.length, index = 0;
    for (index = 0; index < len; index++) {
      if (haystack[index] === needle) {
        return index;
      }
    }
    return -1;
  };
  
  
  Tweetfilter.prototype.arraydiff = function(a, b) {
   var  diff = [];
   awalk: for (var i=0,imax=a.length;i<imax;i++) {
      for (var j=0,jmax=b.length;j<jmax;j++) {
        if (b[j] === a[i]) {
          continue awalk;
        }            
      }
      diff.push(a[i]);
    }
    return diff;
  }
  
  //<debug> function. only called from outside the object scope or by single recursion
  Tweetfilter.prototype._debug = function() {
    var args = Array.prototype.slice.call(arguments); //convert to array
    var that = window.twtfilter; //"this" is window.console
    var debuggroup = false, level = 'L', funcname; //default to ungrouped console.log
    if (typeof args[0] === 'string' && args[0][1] === ':') {
      level = args[0][0];
      if (level === 'F') {
        funcname = args.shift().substr(2);
        debuggroup = 'Function '+funcname;
        if (debuggroup !== that._debuggroup) {
          if (debuggroup) {
            if (that._debugfuncs && (that._debugfunctions.length === 0 || that.inarray(funcname, that._debugfunctions) > -1)) {
              this.log('%c'+debuggroup, 'color:#1F6EBF; border-top:1px dashed #1F6EBF; margin-top:10px; padding-top:5px; font-weight:bold;');
            }
          }
          that._debuggroup = debuggroup;
        }
        that._debug.apply(this, args);
        return;
      } else {
        args[0] = args[0].substr(2);
      }
    }
    funcname = that._debuggroup.substr(9);
    if (that._debuglevels.indexOf(level) > -1 && 
         (that._debugfunctions.length === 0 || that.inarray(funcname, that._debugfunctions) > -1) &&
         (that._debugskipfunctions.length === 0 || that.inarray(funcname, that._debugskipfunctions) === -1)) 
    {
      if (!that._debuggrouped && that._debuggroup) {
        if (typeof args[0] === 'object') {
          args.splice(0, 0, ''); //insert dummy element to avoid string conversion of object to debug
        }
        args[0]='%c'+args[0];
        if (level === 'D' || level === 'L') {
          args.splice(1,0,'padding-left:2em;');
        } else {
          args.splice(1,0,'background-position:2em 0; padding-left:3.5em;');
        }
      } 
      this[({'D':'debug', 'E':'error', 'W':'warn', 'I':'info', 'L':'log'})[level]].apply(this, args);
    }
  };
  
  
  var _D, _F;
  _D = _F = function() {}; //shorthand debug function
// </debug>
  window.twtfilter = new Tweetfilter; //create a neighbor of twttr
// <debug>
  if (!!window.twtfilter.debug && !!window.console) {
    window.twtfilter._debuggroup = false;
    window.twtfilter._debugfuncs = true;
    _D = function() {
      if (typeof console.log.apply === 'function') { //check for bug in firebug 1.8a for firefox 4
        window.twtfilter._debug.apply(console, arguments);
      } else { //simple and ugly logging arguments as an array
        console.log(arguments);
      }
    };
    _F = function(fctname) {
      return 'F:'+fctname;
    }
  }
// </debug>
};

if (window.top === window.self && //don't run in twitter's helper iframes
  !document.getElementById('twtfilterscript'))  //don't inject multiple times (bookmarklet)
{ 
  if (window.location.toString().match(/^https?\:\/\/twitter\.com\/(#.*)?$/)) { //only run on twitter.com
    var tfscript = document.createElement("script"); //create new <script> element
    tfscript.id = 'twtfilterscript';
    var scripttext = TweetfilterPrototype.toString();
    tfscript.text = scripttext.substring(scripttext.indexOf('function Tweetfilter'), scripttext.lastIndexOf('}')); //unwrap the function
    document.body.appendChild(tfscript); //inject the script 
  } else {
    if (confirm("Tweetfilter only runs on twitter.com.\nDo you want to go there now?")) {
      window.location.href='http://twitter.com/';
    }
  }
}