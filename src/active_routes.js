var ActiveRoutes = null;

if(typeof exports != "undefined"){
    exports.ActiveRoutes = ActiveRoutes;
}

(function() {

/**
 * == ActiveRoutes ==
 *
 * Application routing and history management (back button support).
 * 
 * Calling `setRoutes` will setup ActiveRoutes and dispatch the current route (if any)
 * as soon as the page is fully loaded. You can pass in a method, or an array of an
 * object and a method. Each method will receive a hash of named parameters from
 * the route, except routes containing a wildcard, which will receive the matching
 * path as a string.
 * 
 *     ActiveRoutes.setRoutes({
 *         '/': [HomeView,'index'],
 *         '/contact/:id': [ContactView,'contact'],
 *         '/about': function(params){},
 *         '/wiki/*': function(path){}
 *     });
 * 
 * If an object and a method is passed in, another property will be added to that
 * method allowing you to generate a url to the method:
 * 
 *     ContactView.contact.getUrl({id: 5}); //"/contact/5"
 * 
 * In addition when the method is called directly it will automatically update the
 * current path / url and history. Anonymous methods passed in directly cannot
 * generate urls and will not auto update the current path / url / history.
 * 
 * Events
 * ------
 * - ready()
 * - afterDispatch(path,method,params)
 * - externalChange(path)
 **/
 
/**
 * ActiveRoutes
 **/
ActiveRoutes = {
    historyManager: {
        initialize: function(){
            SWFAddress.addEventListener(SWFAddressEvent.EXTERNAL_CHANGE,ActiveRoutes.externalChangeHandler);
        },
        onChange: function(path){
            SWFAddress.setValue(path);
        }
    },
    startObserver: false,
    ready: false,
    routes: [], //array of [path,method]
    routePatterns: [], //array of [regexp,param_name_array]
    currentIndex: 0,
    currentRoute: false,
    history: [],
    paramPattern: '([\\w]+)(/|$)',
    normalizePathDotDotPattern: /[^\/\\]+[\/\\]\.\.[\/\\]/,
    enabled: false,
    /**
     * ActiveRoutes.setRoutes(routes) -> null
     * 
     *     ActiveRoutes.setRoutes({
     *         '/': [HomeView,'index'],
     *         '/contact/:id': [ContactView,'contact'],
     *         '/about': function(params){},
     *         '/wiki/*': function(path){}
     *     });
     *     ContactView.contact.getUrl({id: 5}); //"/contact/5"
     **/
    setRoutes: function setRoutes(routes)
    {
        for(var path in routes)
        {
            var route_is_array = routes[path] && typeof(routes[path]) == 'object' && 'length' in routes[path] && 'splice' in routes[path] && 'join' in routes[path];
            if(route_is_array)
            {
                ActiveRoutes.addRoute(path,routes[path][0],routes[path][1]);
            }
            else
            {
                ActiveRoutes.addRoute(path,routes[path]);
            }
        }
        ActiveRoutes.start();
    },
    /**
     * ActiveRoutes.addRoute(path,method) -> null
     * ActiveRoutes.addRoute(path,object,method) -> null
     **/
    addRoute: function addRoute(path)
    {
        if(arguments[2])
        {
            var object = arguments[1];
            var method = arguments[2];
            var original_method = object[method];
            object[method] = function routing_wrapper(params){
                ActiveRoutes.setRoute(ActiveRoutes.generateUrl(path,params));
                original_method.apply(original_method,arguments);
            };
            object[method].getUrl = function url_generator(params){
                return ActiveRoutes.generateUrl(path,params);
            };
            ActiveRoutes.routes.push([path,object[method]]);
        }
        else
        {
            ActiveRoutes.routes.push([path,arguments[1]]);
        }
        ActiveRoutes.routePatterns.push(ActiveRoutes.routeMatcherFromPath(path));
    },
    routeMatcherFromPath: function routeMatcherFromPath(path)
    {
        var params = [];
        var reg_exp_pattern = path.replace(/\)/g,')?');
        reg_exp_pattern = reg_exp_pattern.replace(/\:([\w]+)(\/?)/g,function(){
            params.push(arguments[1]);
            return ActiveRoutes.paramPattern;
        });
        if(reg_exp_pattern.match(/\*/))
        {
            params.push('path');
            reg_exp_pattern = reg_exp_pattern.replace(/\*/g,'(.+$)');
        }
        return [new RegExp('^' + reg_exp_pattern + '$'),params];
    },
    /**
     * ActiveRoutes.dispatch(path) -> Boolean
     **/
    dispatch: function dispatch(path)
    {
        var match = ActiveRoutes.match(path);
        path = ActiveRoutes.normalizePath(path);
        if(ActiveRoutes.enabled && path != ActiveRoutes.currentRoute && match)
        {
            if(!match[0].getUrl)
            {
                ActiveRoutes.setRoute(path);
            }
            match[0](match[1]);
            this.notify('afterDispatch',path,match[0],match[1]);
            return true;
        }
        else
        {
            return false;
        }
    },
    /**
     * ActiveRoutes.match(path) -> Array | Boolean
     * If a path is matched the response will be array [method,params]
     **/
    match: function match(path)
    {
        path = ActiveRoutes.normalizePath(path);
        for(var i = 0; i < ActiveRoutes.routes.length; ++i)
        {
            if(ActiveRoutes.routes[i][0] == path)
            {
                return [ActiveRoutes.routes[i][1],{}];
            }
        }
        for(var i = 0; i < ActiveRoutes.routePatterns.length; ++i)
        {
            var matches = ActiveRoutes.routePatterns[i][0].exec(path);
            if(matches)
            {
                var params = {};
                for(var ii = 0; ii < ActiveRoutes.routePatterns[i][1].length; ++ii)
                {
                    params[ActiveRoutes.routePatterns[i][1][ii]] = matches[((ii + 1) * 2) - 1];
                }
                return [ActiveRoutes.routes[i][1],params];
            }
        }
        return false;
    },
    generateUrl: function generateUrl(url,params)
    {
        params = params || {};
        if(typeof(params) == 'string' && url.match(/\*/))
        {
            url = url.replace(/\*/,params).replace(/\/\//g,'/');
        }
        else
        {
            var param_matcher = new RegExp('\\:' + ActiveRoutes.paramPattern,'g');
            for(var param_name in params)
            {
                url = url.replace(param_matcher,function(){
                    return arguments[1] == param_name ? params[param_name] + arguments[2] : ':' + arguments[1] + arguments[2];
                });
            }
        }
        return url;
    },
    setRoute: function setRoute(path)
    {
        if(ActiveRoutes.enabled)
        {
            path = ActiveRoutes.normalizePath(path);
            if(ActiveRoutes.currentRoute != path)
            {
                ActiveRoutes.historyManager.onChange(path);
                ActiveRoutes.currentRoute = path;
            }
        }
    },
    /**
     * ActiveRoutes.getCurrentPath() -> String
     **/
    getCurrentPath: function getCurrentPath()
    {
        var path_bits = ActiveSupport.getGlobalContext().location.href.split('#');
        return ActiveRoutes.normalizePath(path_bits[1] && (path_bits[1].match(/^\//) || path_bits[1] == '') ? path_bits[1] : '');
    },
    /**
     * ActiveRoutes.start() -> null
     **/
    start: function start()
    {
        if(!ActiveRoutes.startObserver && !ActiveRoutes.ready)
        {
            ActiveRoutes.startObserver = ActiveSupport.Element.observe(ActiveSupport.getGlobalContext().document,'ready',function document_ready_observer(){
                ActiveRoutes.historyManager.initialize();
                ActiveRoutes.ready = true;
                ActiveRoutes.enabled = true;
                if(ActiveRoutes.notify('ready') !== false)
                {
                    setTimeout(function initial_route_dispatcher(){
                        ActiveRoutes.dispatch(ActiveRoutes.getCurrentPath());
                    });
                }
            });
        }
    },
    externalChangeHandler: function externalChangeHandler()
    {
        if(ActiveRoutes.enabled)
        {
            var current_path = ActiveView.Routing.getCurrentPath();
            if(ActiveRoutes.ready)
            {
                if(current_path != ActiveRoutes.currentRoute)
                {
                    if(ActiveRoutes.notify('externalChange',current_path) !== false)
                    {
                        ActiveRoutes.dispatch(current_path);
                    }
                }
            }
        }
    },
    /**
     * ActiveRoutes.stop() -> null
     **/
    stop: function stop()
    {
        ActiveRoutes.enabled = false;
    },
    /**
     * ActiveRoutes.back() -> null
     **/
    back: function back()
    {
        if(ActiveRoutes.currentIndex == 0)
        {
            return false;
        }
        --ActiveRoutes.currentIndex;
        ActiveRoutes.dispatch(this.history[ActiveRoutes.currentIndex]);
        return true;
    },
    /**
     * ActiveRoutes.forward() -> null
     **/
    forward: function forward()
    {
        if(ActiveRoutes.currentIndex >= ActiveRoutes.history.length - 1)
        {
            return false;
        }
        ++ActiveRoutes.currentIndex;
        ActiveRoutes.dispatch(ActiveRoutes.history[ActiveRoutes.currentIndex]);
        return true;
    },
    /**
     * ActiveRoutes.goTo(index) -> Boolean
     **/
    goTo: function goTo(index)
    {
        return ActiveRoutes.dispatch(ActiveRoutes.history[index]);
    },
    /**
     * ActiveRoutes.getHistory() -> Array
     **/
    getHistory: function getHistory()
    {
        return ActiveRoutes.history;
    },
    normalizePath: function normalizePath(path)
    {
        //remove hash
        path = path.replace(/\#.+$/,'');
        //remove query string
        path = path.replace(/\?.+$/,'');
        //remove trailing and starting slashes, replace backslashes, replace multiple slashes with a single slash
        path = path.replace(/\/{2,}/g,"/").replace(/\\\\/g,"\\").replace(/(\/|\\)$/,'').replace(/\\/g,'/').replace(/^\//,'');
        while(path.match(ActiveRoutes.normalizePathDotDotPattern))
        {
            path = path.replace(ActiveRoutes.normalizePathDotDotPattern,'');
        }
        //replace /index with /
        //path = path.replace(/(\/index$|^index$)/i,'');
        return path;
    }
};
ActiveEvent.extend(ActiveRoutes);

})();
