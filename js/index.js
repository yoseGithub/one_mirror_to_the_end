/* 公用创建类 */
var Class = (function(){
    var create = function(properties){
        properties = properties || {};
        var clazz = properties.hasOwnProperty('constructor') ? properties.constructor : function(){};
        implement.call(clazz, properties);
        return clazz;
    };

    var implement = function(properties){
        var proto = {}, key, value;
        for(key in properties){
            value = properties[key];
            if(classMutators.hasOwnProperty(key)){
                classMutators[key].call(this, value);
            }else{
                proto[key] = value;
            }
        }
    
        mix(this.prototype, proto);
    };
    
    var classMutators = {
        Extends: function(parent){
            var existed = this.prototype, proto = createProto(parent.prototype);
            //inherit static properites
            mix(this, parent);
            //keep existed properties
            mix(proto, existed);
            //correct constructor
            proto.constructor = this;
            //prototype chaining
            this.prototype = proto;
            //shortcut to parent's prototype
            this.superclass = parent.prototype;
        },
    
        Mixes: function(items){
            items instanceof Array || (items = [items]);
            var proto = this.prototype, item;
    
            while(item = items.shift()){
                mix(proto, item.prototype || item);
            }
        },
    
        Statics: function(properties){
            mix(this, properties);
        }
    };

    var createProto = (function(){
        if(Object.__proto__){
            return function(proto){
                return {__proto__: proto};
            };
        }else{
            var Ctor = function(){};
            return function(proto){
                Ctor.prototype = proto;
                return new Ctor();
            };
        }
    })();

    var mix = function(target){
        for(var i = 1, len = arguments.length; i < len; i++){
            var source  = arguments[i], defineProps;
            for(var key in source){
                var prop = source[key];
                if(prop && typeof prop === 'object'){
                    if(prop.value !== undefined || typeof prop.get === 'function' || typeof prop.set === 'function'){
                        defineProps = defineProps || {};
                        defineProps[key] = prop;
                        continue;
                    }
                }
                target[key] = prop;
            }
            if(defineProps) defineProperties(target, defineProps);
        }
    
        return target;
    };
    
    var defineProperty, defineProperties;
    try{
        defineProperty = Object.defineProperty;
        defineProperties = Object.defineProperties;
        defineProperty({}, '$', {value:0});
    }catch(e){
        if('__defineGetter__' in Object){
            defineProperty = function(obj, prop, desc){
                if('value' in desc) obj[prop] = desc.value;
                if('get' in desc) obj.__defineGetter__(prop, desc.get);
                if('set' in desc) obj.__defineSetter__(prop, desc.set);
                return obj;
            };
            defineProperties = function(obj, props){
                for(var prop in props){
                    if(props.hasOwnProperty(prop)){
                        defineProperty(obj, prop, props[prop]);
                    }
                }
                return obj;
            };
        }
    }
    
    return {create:create, mix:mix};
})();

/* 事件发送监听 */
var EventMixin = {
    _listeners: null,

    /**
     * 增加一个事件监听。
     * @param {String} type 要监听的事件类型。
     * @param {Function} listener 事件监听回调函数。
     * @param {Boolean} once 是否是一次性监听，即回调函数响应一次后即删除，不再响应。
     * @returns {Object} 对象本身。链式调用支持。
     */
    on: function(type, listener, once){
        var listeners = (this._listeners = this._listeners || {});
        var eventListeners = (listeners[type] = listeners[type] || []);
        for(var i = 0, len = eventListeners.length; i < len; i++){
            var el = eventListeners[i];
            if(el.listener === listener) return;
        }
        eventListeners.push({listener:listener, once:once});
        return this;
    },

    /**
     * 删除一个事件监听。如果不传入任何参数，则删除所有的事件监听；如果不传入第二个参数，则删除指定类型的所有事件监听。
     * @param {String} type 要删除监听的事件类型。
     * @param {Function} listener 要删除监听的回调函数。
     * @returns {Object} 对象本身。链式调用支持。
     */
    off: function(type, listener){
        //remove all event listeners
        if(arguments.length == 0){
            this._listeners = null;
            return this;
        }

        var eventListeners = this._listeners && this._listeners[type];
        if(eventListeners){
            //remove event listeners by specified type
            if(arguments.length == 1){
                delete this._listeners[type];
                return this;
            }

            for(var i = 0, len = eventListeners.length; i < len; i++){
                var el = eventListeners[i];
                if(el.listener === listener){
                    eventListeners.splice(i, 1);
                    if(eventListeners.length === 0) delete this._listeners[type];
                    break;
                }
            }
        }
        return this;
    },

    /**
     * 发送事件。当第一个参数类型为Object时，则把它作为一个整体事件对象。
     * @param {String} type 要发送的事件类型。
     * @param {Object} detail 要发送的事件的具体信息，即事件随带参数。
     * @returns {Boolean} 是否成功调度事件。
     */
    fire: function(type, detail){
        var event, eventType;
        if(typeof type === 'string'){
            eventType = type;
        }else{
            event = type;
            eventType = type.type;
        }

        var listeners = this._listeners;
        if(!listeners) return false;

        var eventListeners = listeners[eventType];
        if(eventListeners){
            var eventListenersCopy = eventListeners.slice(0);
            event = event || new EventObject(eventType, this, detail);
            if(event._stopped) return false;

            for(var i = 0; i < eventListenersCopy.length; i++){
                var el = eventListenersCopy[i];
                el.listener.call(this, event);
                if(el.once) {
                    var index = eventListeners.indexOf(el);
                    if(index > -1){
                        eventListeners.splice(index, 1);
                    }
                }
            }

            if(eventListeners.length == 0) delete listeners[eventType];
            return true;
        }
        return false;
    }
};

/* 事件对象类，内部事件发送使用 */
var EventObject = Class.create({
    constructor: function EventObject(type, target, detail){
        this.type = type;
        this.target = target;
        this.detail = detail;
        this.timeStamp = +new Date();
    },

    type: null,
    target: null,
    detail: null,
    timeStamp: 0,

    stopImmediatePropagation: function(){
        this._stopped = true;
    }
});

document.addEventListener("touchstart",function(e){
    e.preventDefault();
},{passive: false});

/* 资源数据 */
var date = [
    //sence1
    // {src:'scene_1_yun_6', w:1208  ,h:629 ,x:94 ,y:123 ,z:6908},
    // {src:'scene_1_feiji_01', w:1108, h:933, x:75.6, y:243, z:4758},
    // {src:'03', w:870, h:229, x:5, y:2, z:3055},
    // {src:'scene_1_tiaosan_04' ,w:134 ,h:96,x:-75  ,y:-25 ,z:2709 },
    // {src:'scene_1_tiaosan_03' ,w:221 ,h:171 ,x:5.6 ,y:-5  ,z:2225 },
    // {src:'scene_1_tiaosan_02' ,w:143  ,h:155  ,x:8 ,y:-98  ,z:2639},
    // {src:'scene_1_tiaosan_01',w:160 ,h:107 ,x:129 ,y:26,z:1786 },
    // {src:'scene_1_reqiqiu_02' ,w:184 ,h: 150 ,x:226 ,y:315,z:693 },
    // {src:'scene_1_reqiqiu_01' ,w:223 ,h:215 ,x:132 ,y:-125,z:552 },
    // {src:'scene_1_reqiqiu_03' ,w:111 ,h:107 ,x:-545 ,y:994 ,z:28  },
    // {src:'scene_1_zhishengji_01' ,w:594,h:305 ,x:-171,y:331,z:130},
    // {src:'scene_1_fanhuicang' ,w:492 ,h:492 ,x:-13,y:-51,z:60 },
    // {src:'biaoti_01',w: 402*0.8,h:131*0.8 ,x:0 ,y:185,z:70},
    // //关于y
    // {src:'scene_1_tiaosan_02' ,w: 151,h:155 ,x:19 ,y:110,z:2639},
    // //关于x
    // {src:'scene_1_tiaosan_01' ,w: 160,h:107 ,x:-95 ,y:26,z:1786},

    // //sence2
    // {src:'04' ,w:498 ,h:131 ,x:23 ,y:29,z:8926 },
    // {src:'scene_2_bingkuai_01' ,w:231 ,h:183 ,x:-293 ,y:358,z:12515},
    // {src:'scene_2_bingkuai_02' ,w:97 ,h:119 ,x:15 ,y:522,z:12448},
    // {src:'scene_2_bingkuai_03' ,w:322 ,h:151 ,x:144 ,y:-1098,z:11271 },
    // {src: 'scene_2_bingkuai_06' ,w: 322,h:151 ,x:659 ,y:-546,z:11803 },
    // {src:'scene_2_huixing_01' ,w:468 ,h: 253,x:-641 ,y:864,z:10195 },
    // {src:'scene_2_huixing_02' ,w:1067,h:896 ,x:533 ,y:1717,z:9107 },
    // {src:'scene_2_weixing_01' ,w: 1051,h:732 ,x:-122 ,y:-104 ,z:11687 },
    // {src: 'scene_2_yunshi_01',w: 155,h: 141,x:-220,y:-110,z:10088},
    // {src: 'scene_2_yunshi_02',w:125 ,h:95,x:124 ,y:231,z:9107 },
    // {src: 'scene_2_yunshi_03',w:168 ,h: 102,x:152 ,y:-33,z:10990},
    // {src: 'scene_2_yunshi_04',w:223 ,h:171,x: 266,y:-444,z:9386 },
    // {src:'scene_2_yunshi_05' ,w:150 ,h:115,x:-68 ,y:42,z:11191},

    // //scene_3
    // {src:'scene_3_BG_01a' ,w:1383*1.1 ,h:2460*1.1 ,x:32 ,y:-105 ,z:13399 },
    // {src:'scene_3_shouji_06' ,w:40 ,h:43 ,x:-5  ,y:-44 ,z:14690},
    // {src:'scene_3_shu_01' ,w:53 ,h:61 ,x:30  ,y:246 ,z:13985 },
    // {src:'scene_3_xiangzi_01' ,w:109 ,h:97  ,x:-44 ,y:56 ,z:13943 },
    // {src:'scene_3_xiangzi_02' ,w:97 ,h:112 ,x:162 ,y:-121 ,z:13943 },
    // {src:'scene_3_yuhangyuan_01' ,w:158 ,h:224 ,x:-62 ,y:-10 ,z:14040 },
    // {src:'scene_3_yuhangyuan_02' ,w:164 ,h:188 ,x:48 ,y:-8 ,z:14576 },

    // //scene_4
    // {src:'scene_4_yuhangyuan_02' ,w:448 ,h:338 ,x:96 ,y:-38,z:16426 },
    // {src:'scene_4_yuhangyuan_01' ,w:2167 ,h:1348 ,x:70 ,y:-918,z:22652 },
    // {src:'scene_4_xinqiu_02' ,w: 3418,h:3391 ,x:4987 ,y:-9513,z:-6694 },
    // {src:'scene_4_xinqiu_01' ,w:1877 ,h:1966 ,x:14559 ,y:22065,z:-22000 },
    // {src:'scene_4_weixing_01' ,w:5398 ,h:2083 ,x:-994 ,y:2819,z:17436 },
    // {src:'scene_4_kongjianzhan_01a' ,w:4342 ,h:3291 ,x:142,y:536,z:15046},
    // {src:'scene_4_chuanghu_01' ,w:105 ,h:105 ,x:0.5,y:-17.6,z:15030},
    // {src:'scene_4_hongseguang_01',w:645 ,h:940 ,x:-4612 ,y:-49,z: 14814},
    // {src:'scene_4_yunshi_11' ,w:3243 ,h:5766 ,x:-52 ,y:178,z:19202},
    // {src:'scene_4_yunshi_08' ,w:500 ,h:522 ,x:579 ,y:-989,z:19202},
    // {src:'scene_4_yunshi_05' ,w:458 ,h:396 ,x:370 ,y:223,z:21282 },
    // {src:'scene_4_yunshi_02' ,w:778 ,h:722 ,x:-665 ,y:-869,z:15869 },
    // {src:'scene_4_bingkuai_01' ,w:330 ,h:310  ,x:835 ,y:-392,z:19318 },
    // {src:'scene_4_bingkuai_02' ,w:309 ,h:134 ,x:-288 ,y:-177,z:18652 },
    // {src:'scene_4_bingkuai_05',w:325 ,h:153 ,x:219 ,y:11,z:17043 },
    // {src:'scene_4_bingkuai_07' ,w:387  ,h:305 ,x:-659 ,y:552,z:16779},

    //sence5
    // {src:'scene_5_m6' ,w:2986 ,h:6229 ,x:0,y:-1358,z:65603 },
    // {src: 'sence_5_huojian',w:11070*0.6 ,h:17247*0.6 ,x:118,y:-2063,z:54085 },
    // {src:'sece_5_yun' ,w:5267 ,h:1896 ,x:9,y:-5194,z:54778 },
    // {src:'sence_5_dimian' ,w:16175*1.3 ,h:11201 ,x:-84,y:-10256,z:53225 },
    // {src:'sece_5_huangyun',w:17797*0.6 ,h:9325*0.6 ,x:-1061,y:-2897,z:33425 },
    // {src:'sece_5_huangyun_1' ,w:11059 ,h:8792,x:-332,y:5852,z:29694 },
    // {src:'sece_5_huangyun_2' ,w:10928*1.5 ,h:12425*1.5 ,x:1868,y:1123,z:23416 },
    // {src:'scene_4_xinqiu_03',w:7348,h:7526 ,x:-1714,y:1108,z:24976},
    // {src:'scene_4_xingyun_01' ,w:19552,h:19552 ,x:4349 ,y:8207,z:604},
    // {src:'scene_4_xingyun_02' ,w:38796,h:38796 ,x:-7186 ,y:15479,z:-13568},
    // {src:'scene_4_xingyun_03' ,w:9214,h:9214 ,x:-532 ,y:-3315,z:8354}
    
    //i，图片排序，因为加载后的bitMap已经不存在这些信息，所以将序号放在bitmap的name中
    //场景1
    {src:'scene_1_1.jpg', w:7200, h:12800, x:0, y:0, z:0},
    {src:'scene_1_2.png', w:112, h:93, x:-545, y:994, z:28},
    {src:'scene_1_3.png', w:492, h:492, x:-13, y:-51, z:60},
    {src:'scene_1_4.png', w:620, h:350, x:-171, y:331, z:130},
    //{src:'scene_1_5.png', w:640, h:610, x:132, y:-125, z:552},
    {src:'scene_1_6.png', w:262, h:214, x:226, y:315, z:693},
    {src:'scene_1_7.png', w:448, h:299, x:129, y:26, z:1786},
    {src:'scene_1_8.png', w:320, h:346, x:5.6, y:-5, z:2225},
    {src:'scene_1_9.png', w:640, h:497, x:8, y:-98, z:2639},
    {src:'scene_1_10.png', w:320, h:230, x:-75, y:-25, z:2709},
    {src:'scene_1_11.png', w:860, h:227, x:5, y:2, z:3055},
    {src:'scene_1_12.png', w:3200  ,h:2470 ,x:-250,y:1057 ,z:3994},
    {src:'scene_1_13.png', w:3200  ,h:2390,x:218 ,y:-308 ,z:5539},
    {src:'scene_1_14.png', w:1280, h:1083, x:75.6, y:243, z:4758},
    {src:'scene_1_15.png', w:3200,h:2720,x:-233 ,y:-185 ,z:6792},
    //场景2
    {src:'scene_2_1.jpg' ,w:5138 ,h:9136 ,x:15 ,y:-170,z:7377},
    //{src:'scene_2_2.png', w:498, h:131 ,x:23 ,y:29,z:8926},
    {src:'scene_2_3.png', w:1067, h:896 ,x:533 ,y:1717,z:9107},
    {src:'scene_2_4.png', w:125, h:95,x:124 ,y:231,z:9107},
    {src:'scene_2_5.png', w:223, h:171,x: 266,y:-444,z:9386},
    {src:'scene_2_6.png', w:155, h: 141,x:-220,y:-110,z:10088},
    {src:'scene_2_7.png', w:468, h:253,x:-641 ,y:864,z:10195},
    {src:'scene_2_8.png', w:168, h:102,x:152 ,y:-33,z:10990},
    {src:'scene_2_9.png', w:150, h:115,x:-68 ,y:42,z:11191},  
    {src:'scene_2_10.png', w:322, h:151 ,x:144 ,y:-1098,z:11271},
    {src:'scene_2_11.png', w:1051, h:732 ,x:-122 ,y:-104 ,z:11687}, 
    {src:'scene_2_12.png', w:322, h:151 ,x:659 ,y:-546,z:11803},
    {src:'scene_2_13.png', w:97, h:119 ,x:15 ,y:522,z:12448},
    {src:'scene_2_14.png', w:231, h:183 ,x:-293 ,y:358,z:12515},
]

!(function(lib){
    /* 启动界面 */
    window.addEventListener("DOMContentLoaded",function(){
        var stage = new Stage();
        stage.init();
    });

    /* webgl舞台 */
    var Stage = Class.create({
        Mixes: EventMixin,
        constructor: function(properties){
            properties = properties || {};
            this.id = this.id || properties.id || 'stage';
        },
        container: document.getElementById("page"),
        renderer: new THREE.WebGLRenderer(),
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 12800),
        direction: 0,  //运动方向，负数向屏幕，正数向用户方向
        pause: false,  //停止渲染

        prepare: function(){
            //起始观察点，具体看设计要从那个点开始拉
            this.camera.position.set(0, 0, 6400);
            this.camera.lookAt(this.scene.position);
            this.scene.add(this.camera);
            this.renderer.setClearColor(0x333333);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.container.appendChild(this.renderer.domElement);
        },
        startLoad: function(){
            var me = this;

            var asset = new TextureLoader({
                fileList: date
            });

            asset.on("complete",function(){
                asset.off('complete');
                me.createPlane(asset.bitMaps);
            })
        },
        createPlane: function(bitMaps){
            var me = this;

            var pend = new Pendant({
                maps: bitMaps
            });

            pend.on("complete",function(){
                pend.off('complete');
                me.scene.add(pend.boxGroup);
                me.render();
            });
        },
        shake: function(){
            var me = this,
                orienter = new Orienter();

            orienter.orient = function (objed) {
                if(objed.b > 0 && objed.b < 85) me.camera.position.y = (objed.b-85)*1.412345678;
                if(objed.g > -35 && objed.g < 35)  me.camera.position.x = objed.g*1.71234564156415151515;
            };

            orienter.init();
        },
        touchEvent: function(){

            var me = this,
                container = $(this.container);

            container.swipeDown(function(e){
                me.pause = false;
                if(me.direction > 0) me.direction = -3;
                me.direction--;
            });

            container.swipeUp(function(e){
                me.pause = false;
                if(me.direction < 0) me.direction = 3;
                me.direction++;
            });
        },
        render: function(){
            if(!this.pause) this.camera.position.z += this.direction;

            if(this.camera.position.z >= 13800){
                this.camera.position.z = 13800;
                this.pause = true;
            }
            if(this.camera.position.z <= 1120){
                this.camera.position.z = 1120;
                this.pause = true;
            }

            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(function(){
                this.render();
            }.bind(this));
        },
        init: function(){
            this.prepare();
            this.shake();
            this.touchEvent();
            this.startLoad();
        }
    })

    /* textureLoader下载器 */
    var TextureLoader = Class.create({
        Mixes: EventMixin,
        constructor: function(properties){
            properties = properties || {};
            this.id = this.id || properties.id || 'loader';

            this.fileList = properties.fileList || [];
            this.bitMaps = [];

            //this.loadAsset(this.fileList);
            this.loaderQueue(this.bitMaps);
        },
        // loadAsset: function(fileList){
        //     var loader = new PxLoader();

        //     this.fileList.forEach(function(e,i){
        //         loader.addImage("images/" + fileList[i].src + ".png");
        //     })

        //     loader.start();

        //     loader.addCompletionListener(function(e) {
        //         console.log(111);
        //         this.loaderQueue(this.fileList,this.bitMaps);
        //     }.bind(this));
        // },
        loaderQueue: function(bitMaps){
            var loader = new THREE.TextureLoader(),
                loadSize = 0,
                me = this;

            this.fileList.forEach(function(e,i){
                loader.load("images/" + e.src, function(bitmap){
                    bitmap.name = i;
                    /*
                        解决报image is not power of two
                        https://threejs.org/docs/index.html#api/constants/Textures
                        为了加快渲染速度和减少纹理锯齿，贴图被处理成由一系列被预先计算和优化过的图片组成的文件，这样的贴图被称为Mipmap
                        六个值为不同的图像重采样插值算法
                        反正我是看不懂…测试了用NearestFilter 和 LinearFilter都不会报了，但NearestFilter栅格化严重
                    */
                    bitmap.minFilter = THREE.LinearFilter;
                    bitmap.magFilter = THREE.LinearFilter;
                    loadSize++;
                    bitMaps.push(bitmap);
                    me.progress(loadSize);
                },undefined,me.catchErr)
            })
        },
        catchErr: function(err){
            console.log(err)
        },
        progress: function(prog){
            //将图片重新进行排序，因为下载完成就进数组里，而下载完成的结果并不是按照顺序来的
            function sortNumber(a,b){ return a.name - b.name; }

            //暂时没有任何容灾处理，默认所有资源全部成功
            if(~~(prog / this.fileList.length) == 1){
                this.bitMaps.sort(sortNumber);
                this.fire("complete");
            }
        }
    })

    /* 挂件层，放置所有视觉平面，不知道叫啥好，就叫挂件吧 */
    var Pendant = Class.create({
        Mixes: EventMixin,
        constructor: function(properties){
            properties = properties || {};
            this.id = this.id || properties.id || 'Pendant';

            this.boxGroup = new THREE.Group();

            /* 传入数据及纹理图，开始绘制各个挂件平面 */
            this.drawScene(date, properties.maps);
        },
        drawScene: function(data, maps){
            data.forEach(function(elm,i){
                if(i == 21){ this.createPlane(elm.w, elm.h, maps[i], elm.x, elm.y, elm.z); }
                else if( i== 22){ this.createPlane(elm.w, elm.h, maps[i], elm.x, elm.y, elm.z); }
                else{ this.createPlane(elm.w, elm.h, maps[i], elm.x, elm.y, elm.z); }
            }.bind(this));
            
            /* 印象中小米好像不设置成100还是会渲染不出来…存写速度太慢… */
            setTimeout(function(){
                this.fire("complete");
            }.bind(this),10)
        },
        createPlane: function(w, h, mt, x, y, z){
            var sceneGeometry = new THREE.PlaneGeometry(w, h);
            var sceneMaterial = new THREE.MeshBasicMaterial({
                map: mt,
                transparent: true,
                side: THREE.DoubleSide
            });
            var scenePlaneMesh = new THREE.Mesh(sceneGeometry, sceneMaterial);
            scenePlaneMesh.position.x = x;
            scenePlaneMesh.position.y = y;
            scenePlaneMesh.position.z = z;
            this.boxGroup.add(scenePlaneMesh);
        }
    })
})(window)