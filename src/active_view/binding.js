/* ***** BEGIN LICENSE BLOCK *****
 * 
 * Copyright (c) 2009 Aptana, Inc.
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 * 
 * ***** END LICENSE BLOCK ***** */

ActiveView.generateBinding = function generateBinding(instance)
{
    instance.binding = {};
    instance.binding.update = function update(element)
    {
        return {
            from: function from(observe_key)
            {
                var object = instance.scope;
                if(arguments.length == 2)
                {
                    object = arguments[1];
                    observe_key = arguments[2];
                }
                
                var transformation = null;
                var condition = function default_condition(){
                    return true;
                };
                
                var transform = function transform(callback)
                {
                    transformation = callback;
                    return {
                        when: when
                    };
                };

                var when = function when(callback)
                {
                    condition = callback;
                    return {
                        transform: transform
                    };
                };

                object.observe('set',function update_from_observer(set_key,value){
                    if(observe_key == set_key)
                    {
                        if(condition())
                        {
                            element.innerHTML = transformation ? transformation(value) : value;
                        }
                    }
                });
                
                return {
                    transform: transform,
                    when: when
                };
            }
        };
    };

    instance.binding.collect = function collect(view)
    {
        return {
            from: function from(collection)
            {
                return {
                    into: function into(element)
                    {
                        //if a string is passed make sure that the view is re-built when the key is set
                        if(typeof(collection) == 'string')
                        {
                            var collection_name = collection;
                            instance.scope.observe('set',function collection_key_change_observer(key,value){
                                if(key == collection_name)
                                {
                                    element.innerHTML = '';
                                    instance.binding.collect(view).from(value).into(element);
                                }
                            });
                            collection = instance.scope.get(collection);
                        }
                        //loop over the collection when it is passed in to build the view the first time
                        var collected_elements = [];
                        for(var i = 0; i < collection.length; ++i)
                        {
                            ActiveView.render(view,element,collection[i],false);
                            collected_elements.push(element.childNodes[element.childNodes.length - 1]);
                        }
                        //these handlers will add or remove elements from the view as the collection changes
                        if(collection.observe)
                        {
                            collection.observe('pop',function pop_observer(){
                                collected_elements[collected_elements.length - 1].parentNode.removeChild(collected_elements[collected_elements.length - 1]);
                                collected_elements.pop();
                            });
                            collection.observe('push',function push_observer(item){
                                ActiveView.render(view,element,item,false);
                                collected_elements.push(element.childNodes[element.childNodes.length - 1]);
                            });
                            collection.observe('unshift',function unshift_observer(item){
                                ActiveView.render(view,element,item,false,function unshift_observer_render_executor(element,content){
                                    element.insertBefore(content,element.firstChild);
                                });
                                collected_elements.unshift(element.firstChild);
                            });
                            collection.observe('shift',function shift_observer(){
                                element.removeChild(element.firstChild);
                                collected_elements.shift(element.firstChild);
                            });
                            collection.observe('splice',function splice_observer(index,to_remove){
                                var children = [];
                                var i;
                                for(i = 2; i < arguments.length; ++i)
                                {
                                    children.push(arguments[i]);
                                }
                                if(to_remove)
                                {
                                    for(i = index; i < (index + to_remove); ++i)
                                    {
                                        collected_elements[i].parentNode.removeChild(collected_elements[i]);
                                    }
                                }
                                for(i = 0; i < children.length; ++i)
                                {
                                    if(index == 0 && i == 0)
                                    {
                                        ActiveView.render(view,element,children[i],false,function splice_observer_render_executor(element,content){
                                            element.insertBefore(content,element.firstChild);
                                            children[i] = element.firstChild;
                                        });
                                    }
                                    else
                                    {
                                        ActiveView.render(view,element,children[i],false,function splice_observer_render_executor(element,content){
                                            element.insertBefore(typeof(content) == 'string' ? document.createTextNode(content) : content,element.childNodes[index + i]);
                                            children[i] = element.childNodes[i + 1];
                                        });
                                    }
                                }
                                collected_elements.splice.apply(collected_elements,[index,to_remove].concat(children));
                            });
                        }
                    }
                };
            }
        };
    };

    instance.binding.when = function when(outer_key)
    {
        return {
            changes: function changes(callback)
            {
                instance.observe('set',function changes_observer(inner_key,value){
                    if(outer_key == inner_key)
                    {
                        callback(value);
                    }
                });
            }
        };
    };
};