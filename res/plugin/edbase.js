var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");

Language.Register({
	name:"Plain text",rules:function(lang){
		lang.DefineDefaultColor("color")
		return function(){}
	}
})

var f_C_like=function(lang,keywords,has_preprocessor){
	lang.DefineDefaultColor("color_symbol")
	var bid_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
	var bid_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
	var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
	var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
	var bid_preprocessor
	if(has_preprocessor){
		bid_preprocessor=lang.ColoredDelimiter("key","#","\n","color_meta");
	}else{
		bid_preprocessor=bid_comment
	}
	var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
	lang.DefineToken("\\\\")
	lang.DefineToken("\\'")
	lang.DefineToken('\\"')
	lang.DefineToken('\\\n')
	var kwset=lang.DefineKeywordSet("color_symbol");
	for(var k in keywords){
		kwset.DefineKeywords("color_"+k,keywords[k])
	}
	kwset.DefineWordColor("color")
	kwset.DefineWordType("color_number","0-9")
	return (function(lang){
		if(has_preprocessor){
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2,bid_preprocessor]);
		}else{
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2]);
		}
		if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)||lang.isInside(bid_preprocessor)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
	});
};

Language.Register({
	name:"C/C++",extensions:["c","cxx","cpp","cc","h","hpp"],
	has_pointer_ops:1,
	rules:function(lang){
		return f_C_like(lang,{
			keyword:['__asm','__declspec','if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','using'],
			type:['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t']
		},1)
	}
})

Language.Register({
	name:'SPAP#',extensions:['spap'],
	has_dlist_type:1,
	has_pointer_ops:1,
	indent_as_bracelet:1,
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['enum','if','else','elif','switch','case','default','break','continue','goto','return','for','while','do','loop','const','static','struct','union','class','function','F','sizeof','new','delete','import','export','typedef','stdcall','inline','operator','forall','foreach','in','this','module','project','true','false','abstract','interface','virtual','__host__','__device__','__operation__'],
			'meta':['If','Else','Elif','For','Switch','Case','Default','#include','#flavor','#make'],
			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','string','Object','Interface','typename','typeof'],
		},0)
	}
});

Language.Register({
	name:'Jacy',extensions:['jc'],
	indent_as_bracelet:1,
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['enum','if','else','elif','switch','case','default','break','continue','return','for','const','struct','class','function','sizeof','new','delete','import','export','typedef','inline','__inline_loop_body','operator','foreach','in','this','module','true','false'],
			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','string','Object','Interface','typename','typeof'],
		},0)
	}
});

Language.Register({
	name:'Microsoft IDL',extensions:['idl'],
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['enum','interface','coclass','midl_pragma','import','library','cpp_quote','const','typedef','extern','struct','union'],
		},1)
	}
});

Language.Register({
	name:'HLSL shader',extensions:['hlsl'],
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['AppendStructuredBuffer','Asm','Asm_fragment','Break','Centroid','Column_major','Compile','Compile_fragment','CompileShader','Const','Continue','ComputeShader','Discard','Do','DomainShader','Else','Extern','False','For','Fxgroup','GeometryShader','Groupshared','Hullshader','If','In','Inline','Inout','InputPatch','Interface','Line','Lineadj','Linear','LineStream','Namespace','Nointerpolation','Noperspective','NULL','Out','OutputPatch','Packoffset','Pass','Pixelfragment','PixelShader','Precise','Return','Register','Row_major','Shared','Snorm','Stateblock','Stateblock_state','Static','Struct','Switch','True','Typedef','Triangle','Triangleadj','TriangleStream','Uniform','Unorm','Vertexfragment','VertexShader','Void','Volatile','While','appendstructuredbuffer','asm','asm_fragment','break','centroid','column_major','compile','compile_fragment','compileshader','const','continue','computeshader','discard','do','domainshader','else','extern','false','for','fxgroup','geometryshader','groupshared','hullshader','if','in','inline','inout','inputpatch','interface','line','lineadj','linear','linestream','namespace','nointerpolation','noperspective','null','out','outputpatch','packoffset','pass','pixelfragment','pixelshader','precise','return','register','row_major','shared','snorm','stateblock','stateblock_state','static','struct','switch','true','typedef','triangle','triangleadj','trianglestream','uniform','unorm','vertexfragment','vertexshader','void','volatile','while'],
			'type':['BlendState','Bool','Buffer','ByteAddressBuffer','CBuffer','ConsumeStructuredBuffer','DepthStencilState','DepthStencilView','Double','Dword','Float','Half','Int','Matrix','Min16float','Min10float','Min16int','Min12int','Min16uint','Point','PointStream','RasterizerState','RenderTargetView','RWBuffer','RWByteAddressBuffer','RWStructuredBuffer','RWTexture1D','RWTexture1DArray','RWTexture2D','RWTexture2DArray','RWTexture3D','Sampler','Sampler1D','Sampler2D','Sampler3D','SamplerCUBE','Sampler_State','SamplerState','SamplerComparisonState','String','StructuredBuffer','TBuffer','Technique','Technique10','Technique11xz','texture1','Texture1D','Texture1DArray','Texture2D','Texture2DArray','Texture2DMS','Texture2DMSArray','Texture3D','TextureCube','TextureCubeArray','Uint','Vector','blendstate','bool','buffer','byteaddressbuffer','cbuffer','consumestructuredbuffer','depthstencilstate','depthstencilview','double','dword','float','half','int','matrix','min16float','min10float','min16int','min12int','min16uint','point','pointstream','rasterizerstate','rendertargetview','rwbuffer','rwbyteaddressbuffer','rwstructuredbuffer','rwtexture1d','rwtexture1darray','rwtexture2d','rwtexture2darray','rwtexture3d','sampler','sampler1d','sampler2d','sampler3d','samplercube','sampler_state','samplerstate','samplercomparisonstate','string','structuredbuffer','tbuffer','technique','technique10','technique11xz','texture1','texture1d','texture1darray','texture2d','texture2darray','texture2dms','texture2dmsarray','texture3d','texturecube','texturecubearray','uint','vector','float2','float3','float4','int2','int3','int4','uint2','uint3','uint4'],
		},1)
	}
});

Language.Register({
	name:'GLSL shader',extensions:['glsl','essl'],
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['__asm','__declspec','if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','using','attribute','uniform','varying','layout','centroid','flat','smooth','noperspective','patch','sample','subroutine','in','out','inout','invariant','discard','lowp','mediump','highp','precision'],
			'type':['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t','mat2','mat3','mat4','dmat2','dmat3','dmat4','mat2x2','mat2x3','mat2x4','dmat2x2','dmat2x3','dmat2x4','mat3x2','mat3x3','mat3x4','dmat3x2','dmat3x3','dmat3x4','mat4x2','mat4x3','mat4x4','dmat4x2','dmat4x3','dmat4x4','vec2','vec3','vec4','ivec2','ivec3','ivec4','bvec2','bvec3','bvec4','dvec2','dvec3','dvec4','uvec2','uvec3','uvec4','sampler1D','sampler2D','sampler3D','samplerCube','sampler1DShadow','sampler2DShadow','samplerCubeShadow','sampler1DArray','sampler2DArray','sampler1DArrayShadow','sampler2DArrayShadow','isampler1D','isampler2D','isampler3D','isamplerCube','isampler1DArray','isampler2DArray','usampler1D','usampler2D','usampler3D','usamplerCube','usampler1DArray','usampler2DArray','sampler2DRect','sampler2DRectShadow','isampler2DRect','usampler2DRect','samplerBuffer','isamplerBuffer','usamplerBuffer','sampler2DMS','isampler2DMS','usampler2DMS','sampler2DMSArray','isampler2DMSArray','usampler2DMSArray','samplerCubeArray','samplerCubeArrayShadow','isamplerCubeArray','usamplerCubeArray'],
		},1)
	}
});

Language.Register({
	name:'Java',extensions:['java'],
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['abstract','assert','break','case','catch','class','const','continue','default','do','else','enum','extends','final','finally','for','goto','if','implements','import','instanceof','interface','native','new','package','private','protected','public','return','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','while','false','null','true'],
			'type':['volatile','byte','long','char','boolean','double','float','int','short','void'],
		},0)
	}
});

Language.Register({
	name:'BSGP',extensions:['i'],
	has_dlist_type:1,
	has_pointer_ops:1,
	indent_as_bracelet:1,
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['if','else','elif','switch','case','default','break','continue','goto','return','for','while','do','loop','const','static','struct','union','class','namespace','function','Func','sizeof','new','delete','import','export','typedef','stdcall','inline','__fastcall','with','operator','forall','this','uses','need','using','autouses','require','spawn','__interrupt__','__both__','__device__','__host__','__shared__','barrier','par','novirtual','__force_template','try','catch','finally','throw','classof'],
			'meta':['def','If','Else','Elif','For','Switch','Case','Default','#define','#include','#def','#undef'],
			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','typename','typeof'],
		},0)
	}
});

Language.Register({
	name:'CUDA',extensions:['cu','cuh'],
	has_pointer_ops:1,
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','__global__','__device__','__host__'],
			'type':['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t'],
		},1)
	}
});

Language.Register({
	name:'Javascript',extensions:['js'],
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['break','export','return','case','for','switch','comment','function','this','continue','if','default','import','delete','in','do','label','while','else','new','with','abstract','implements','protected','instanceOf','public','interface','static','synchronized','false','native','throws','final','null','transient','package','true','goto','private','catch','enum','throw','class','extends','try','const','finally','debugger','super'],
			'type':['typeof','var','void','boolean','byte','int','short','char','double','long','float'],
		},1)
	}
});

Language.Register({
	name:'HTML',extensions:['htm','html'],
	rule:function(lang,keywords,has_preprocessor){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","<!--","-->","color_comment");
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_script=lang.ColoredDelimiter("key","<script","</script>","color_symbol2");
		var bid_js_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		var bid_js_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
		var bid_js_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
		lang.DefineToken("&amp;")
		lang.DefineToken("&apos;")
		lang.DefineToken('&quot;')
		lang.DefineToken('&lt;')
		lang.DefineToken('&gt;')
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineKeywords("color_keyword",["DOCTYPE","a","abbr","acronym","address","applet","area","article","aside","audio","b","base","basefont","bdi","bdo","big","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","datalist","dd","del","details","dfn","dialog","dir","div","dl","dt","em","embed","fieldset","figcaption","figure","font","footer","form","frame","frameset","h1","head","header","hr","html","i","iframe","img","input","ins","kbd","keygen","label","legend","li","link","main","map","mark","menu","menuitem","meta","meter","nav","noframes","noscript","object","ol","optgroup","option","output","p","param","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strike","strong","style","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","tt","u","ul","var","video","wbr"])
		kwset.DefineWordColor("color")
		kwset=lang.DefineKeywordSet("color_symbol2");
		kwset.DefineKeywords("color_keyword",[
			'script',
			'break','export','return','case','for','switch','comment','function','this','continue','if','default','import','delete','in','do','label','while','else','new','with','abstract','implements','protected','instanceOf','public','interface','static','synchronized','false','native','throws','final','null','transient','package','true','goto','private','catch','enum','throw','class','extends','try','const','finally','debugger','super','window','document'])
		kwset.DefineKeywords("color_type",['typeof','var','void','boolean','byte','int','short','char','double','long','float'])
		kwset.DefineWordColor("color")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_string,bid_string2]);
			lang.SetExclusive([bid_comment,bid_script]);
			if(lang.isInside(bid_script)){
				lang.SetExclusive([bid_js_comment,bid_js_comment2,bid_string,bid_string2]);
				if(lang.isInside(bid_js_comment)||lang.isInside(bid_js_comment2)){
					lang.Enable(bid_js_bracket);
				}else{
					lang.Disable(bid_js_bracket);
				}
			}else{
				lang.Disable(bid_js_bracket);
				lang.Disable(bid_js_comment);
				lang.Disable(bid_js_comment2);
			}
		});
	}
});

Language.Register({
	name:'XML',extensions:['xml','vcproj','vcxproj','sproj','sln'],
	rule:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","<!--","-->","color_comment");
		var bid_cdata=lang.ColoredDelimiter("key","<![CDATA[","]]>","color_symbol2");
		var bid_header=lang.ColoredDelimiter("key","<?","?>","color_meta");
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['<'],['</','/>']);
		lang.DefineToken("&amp;")
		lang.DefineToken("&apos;")
		lang.DefineToken('&quot;')
		lang.DefineToken('&lt;')
		lang.DefineToken('&gt;')
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineWordColor("color")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_cdata,bid_header,bid_string,bid_string2]);
			if(lang.isInside(bid_comment)||lang.isInside(bid_cdata)||lang.isInside(bid_header)||lang.isInside(bid_string)||lang.isInside(bid_string2)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
		});
	}
});

var f_shell_like=function(lang,keywords){
	lang.DefineDefaultColor("color_symbol")
	var bid_comment=lang.ColoredDelimiter("key","#","\n","color_comment");
	var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
	lang.DefineToken('\\\n')
	var kwset=lang.DefineKeywordSet("color_symbol");
	for(var k in keywords){
		kwset.DefineKeywords("color_"+k,keywords[k])
	}
	kwset.DefineWordColor("color")
	kwset.DefineWordType("color_number","0-9")
	return (function(lang){
		if(lang.isInside(bid_comment)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
	});
}

Language.Register({
	name:'RenderMan RIB',extensions:['rib'],
	rules:function(lang){
		f_shell_like(lang,{
			'keyword':['RiArchiveRecord','RiAreaLightSource','RiAtmosphere','RiAttribute','RiAttributeBegin','RiAttributeEnd','RiBasis','RiBegin','RiBlobby','RiBound','RiClipping','RiClippingPlane','RiColor','RiColorSamples','RiConcatTransform','RiCone','RiContext','RiCoordinateSystem','RiCoordSysTransform','RiCropWindow','RiCurves','RiCylinder','RiDeclare','RiDepthOfField','RiDetail','RiDetailRange','RiDisk','RiDisplacement','RiDisplay','RiEnd','RiErrorHandler','RiExposure','RiExterior','RiFormat','RiFrameAspectRatio','RiFrameBegin','RiFrameEnd','RiGeneralPolygon','RiGeometricApproximation','RiGeometry','RiGetContext','RiHider','RiHyperboloid','RiIdentity','RiIlluminate','RiImager','RiInterior','RiLightSource','RiMakeCubeFaceEnvironment','RiMakeLatLongEnvironment','RiMakeShadow','RiMakeTexture','RiMatte','RiMotionBegin','RiMotionEnd','RiNuPatch','RiObjectBegin','RiObjectEnd','RiObjectInstance','RiOpacity','RiOption','RiOrientation','RiParaboloid','RiPatch','RiPatchMesh','RiPerspective','RiPixelFilter','RiPixelSamples','RiPixelVariance','RiPoints','RiPointsGeneralPolygons','RiPointsPolygons','RiPolygon','RiProcedural','RiProjection','RiQuantize','RiReadArchive','RiRelativeDetail','RiReverseOrientation','RiRotate','RiScale','RiScreenWindow','RiShadingInterpolation','RiShadingRate','RiShutter','RiSides','RiSkew','RiSolidBegin','RiSolidEnd','RiSphere','RiSubdivisionMesh','RiSurface','RiTextureCoordinates','RiTorus','RiTransform','RiTransformBegin','RiTransformEnd','RiTransformPoints','RiTranslate','RiTrimCurve','RiWorldBegin','RiWorldEnd'],
		})
	}
});
Language.Register({
	name:'WaveFront OBJ',extensions:['obj'],
	rules:function(lang){
		f_shell_like(lang,{
			'keyword':['usemtl','mtllib','g','s','o'],
			'type':['v','vn','vt','f'],
		})
	}
});
Language.Register({
	name:'WaveFront MTL',extensions:['mtl'],
	rules:function(lang){
		f_shell_like(lang,{
			'keyword':['newmtl'],
			'type':['Ka','Kd','Ks','illum','Ns','map_Kd','map_bump','bump','map_opacity','map_d','refl','map_kS','map_kA','map_Ns'],
		})
	}
});

//Language.Register({
//	name:'TeX/LaTeX',extensions:['tex','cls'],
//	curly_bracket_is_not_special:1,is_tex_like:1,
//	rule:function(lang){
//		'type':['begin','end','addcontentsline','addtocontents','addtocounter','address','addtolength','addvspace','alph','appendix','arabic','author','backslash','baselineskip','baselinestretch','bf','bibitem','bigskipamount','bigskip','boldmath','boldsymbol','cal','caption','cdots','centering','chapter','circle','cite','cleardoublepage','clearpage','cline','closing','color','copyright','dashbox','date','ddots','documentclass[options]','dotfill','em','emph','ensuremath(LaTeX2e)','epigraph','euro','fbox','flushbottom','fnsymbol','footnote','footnotemark','footnotesize','footnotetext','frac','frame','framebox','frenchspacing','hfill','hline','href','hrulefill','hspace','huge','Huge','hyphenation','include','includegraphics','includeonly','indent','input','it','item','kill','label','large','Large','LARGE','LaTeX','LaTeXe','ldots','lefteqn','line','linebreak','linethickness','linewidth','listoffigures','listoftables','location','makebox','maketitle','markboth','mathcal','mathop','mbox','medskip','multicolumn','multiput','newcommand','newcolumntype','newcounter','newenvironment','newfont','newlength','newline','newpage','newsavebox','newtheorem','nocite','noindent','nolinebreak','nonfrenchspacing','normalsize','nopagebreak','not','onecolumn','opening','oval','overbrace','overline','pagebreak','pagenumbering','pageref','pagestyle','par','paragraph','parbox','parindent','parskip','part','protect','providecommand','put','raggedbottom','raggedleft','raggedright','raisebox','ref','renewcommand','rm','roman','rule','savebox','sbox','sc','scriptsize','section','setcounter','setlength','settowidth','sf','shortstack','signature','sl','slash','small','smallskip','sout','space','sqrt','stackrel','stepcounter','subparagraph','subsection','subsubsection','tableofcontents','telephone','TeX','textbf','textcolor','textit','textmd','textnormal','textrm','textsc','textsf','textsl','texttt','textup','textwidth','textheight','thanks','thispagestyle','tiny','title','today','tt','twocolumn','typeout','typein','uline','underbrace','underline','unitlength','usebox','usecounter','uwave','value','vbox','vcenter','vdots','vector','verb','vfill','vline','vphantom','vspace','usepackage','documentclass'],
//		'misc':['left','right'],
//	}
//});
//Language.Register({
//	name:'Bibliography',extensions:['bib'],
//	curly_bracket_is_not_special:1,is_tex_like:1,
//});

Language.Register({
	name:'Matlab',extensions:['m'],
	rule:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","%","\n","color_comment");
		var bid_string=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		var kwset=lang.DefineKeywordSet("color_symbol");
		lang.DefineToken('\\\n')
		lang.DefineToken("\\'")
		lang.DefineToken(".'")
		kwset.DefineKeywords("color_type",['abs','accumarray','acos','acosd','acosh','acot','acotd','acoth','acsc','acscd','acsch','actxcontrol','actxcontrollist','actxcontrolselect','actxGetRunningServer','actxserver','addCause','addevent','addframe','addlistener','addOptional','addParamValue','addpath','addpref','addprop','addproperty','addRequired','addsample','addsampletocollection','addtodate','addts','airy','align','alim','all','allchild','alpha','alphamap','amd','ancestor','and','angle','ans','any','append','area','arrayfun','ascii','asec','asecd','asech','asin','asind','asinh','assert','assignin','atan','atan2','atand','atanh','audiodevinfo','audioplayer','audiorecorder','aufinfo','auread','auwrite','avifile','aviinfo','aviread','axes','axis','balance','bar','bar3','bar3h','barh','baryToCart','base2dec','beep','BeginInvoke','bench','besselh','besseli','besselj','besselk','bessely','beta','betainc','betaincinv','betaln','bicg','bicgstab','bicgstabl','bin2dec','binary','bitand','bitcmp','bitget','bitmax','bitnot','bitor','bitset','bitshift','bitxor','blanks','blkdiag','box','break','brighten','brush','bsxfun','builddocsearchdb','builtin','bvp4c','bvp5c','bvpget','bvpinit','bvpset','bvpxtend','calendar','calllib','callSoapService','camdolly','cameratoolbar','camlight','camlookat','camorbit','campan','campos','camproj','camroll','camtarget','camup','camva','camzoom','cart2pol','cart2sph','cartToBary','case','cast','cat','catch','caxis','cd','cdf2rdf','cdfepoch','cdfinfo','cdflib','cdfread','cdfwrite','ceil','cell','cell2mat','cell2struct','celldisp','cellfun','cellplot','cellstr','cgs','char','checkcode','checkin','checkout','chol','cholinc','cholupdate','circshift','circumcenters','cla','clabel','class','classdef','clc','clear','clear','clearvars','clf','clipboard','clock','close','close','closereq','cmopts','cmpermute','cmunique','colamd','colorbar','colordef','colormap','colormapeditor','ColorSpec','colperm','Combine','comet','comet3','commandhistory','commandwindow','compan','compass','complex','computer','computeStrip','computeTile','cond','condeig','condest','coneplot','conj','continue','contour','contour3','contourc','contourf','contourslice','contrast','conv','conv2','convexHull','convhull','convhulln','convn','copy','copyfile','copyobj','corrcoef','cos','cosd','cosh','cot','cotd','coth','cov','cplxpair','cputime','createClassFromWsdl','createCopy','createSoapMessage','cross','csc','cscd','csch','csvread','csvwrite','ctranspose','cumprod','cumsum','cumtrapz','curl','currentDirectory','customverctrl','cylinder','daqread','daspect','datacursormode','datatipinfo','date','datenum','datestr','datetick','datevec','dbclear','dbcont','dbdown','dblquad','dbmex','dbquit','dbstack','dbstatus','dbstep','dbstop','dbtype','dbup','dde23','ddeget','ddesd','ddeset','deal','deblank','dec2base','dec2bin','dec2hex','decic','deconv','del2','delaunay','delaunay3','delaunayn','DelaunayTri','delete','delete','delete','delete','delete','deleteproperty','delevent','delsample','delsamplefromcollection','demo','depdir','depfun','det','detrend','deval','diag','dialog','diary','diff','diffuse','dir','disp','disp','disp','disp','disp','display','dither','divergence','dlmread','dlmwrite','dmperm','doc','docsearch','dos','dot','double','dragrect','drawnow','dsearch','dsearchn','dynamicprops','echo','echodemo','edgeAttachments','edges','edit','eig','eigs','ellipj','ellipke','ellipsoid','empty','enableNETfromNetworkDrive','enableservice','end','EndInvoke','enumeration','eomday','eps','eq','eq','erf','erfc','erfcinv','erfcx','erfinv','error','errorbar','errordlg','etime','etree','etreeplot','eval','evalc','evalin','eventlisteners','events','events','Execute','exifread','exist','exit','exp','expint','expm','expm1','export2wsdlg','eye','ezcontour','ezcontourf','ezmesh','ezmeshc','ezplot','ezplot3','ezpolar','ezsurf','ezsurfc','faceNormals','factor','factorial','false','fclose','fclose','feather','featureEdges','feof','ferror','feval','Feval','fft','fft2','fftn','fftshift','fftw','fgetl','fgetl','fgets','fgets','fieldnames','figure','figurepalette','fileattrib','filebrowser','filemarker','fileparts','fileread','filesep','fill','fill3','filter','filter2','find','findall','findfigs','findobj','findobj','findprop','findstr','finish','fitsdisp','fitsinfo','fitsread','fitswrite','fix','flipdim','fliplr','flipud','floor','flow','fminbnd','fminsearch','fopen','fopen','format','fplot','fprintf','fprintf','frame2im','fread','fread','freeBoundary','freqspace','frewind','fscanf','fscanf','fseek','ftell','FTP','full','fullfile','func2str','function','function_handle','functions','funm','fwrite','fwrite','fzero','gallery','gamma','gammainc','gammaincinv','gammaln','gca','gcbf','gcbo','gcd','gcf','gco','ge','genpath','genvarname','get','get','get','get','get','get','get','get','getabstime','getabstime','getappdata','getaudiodata','GetCharArray','getdatasamples','getdatasamplesize','getDefaultScalarElement','getdisp','getenv','getfield','getFileFormats','getframe','GetFullMatrix','getinterpmethod','getpixelposition','getpref','getProfiles','getqualitydesc','getReport','getsamples','getsampleusingtime','getsampleusingtime','getTag','getTagNames','gettimeseriesnames','gettsafteratevent','gettsafterevent','gettsatevent','gettsbeforeatevent','gettsbeforeevent','gettsbetweenevents','GetVariable','getVersion','GetWorkspaceData','ginput','global','gmres','gplot','grabcode','gradient','graymon','grid','griddata','griddata3','griddatan','griddedInterpolant','gsvd','gt','gtext','guidata','guide','guihandles','gunzip','gzip','h5create','h5disp','h5info','h5read','h5readatt','h5write','h5writeatt','hadamard','handle','hankel','hdf','hdf5','hdf5info','hdf5read','hdf5write','hdfinfo','hdfread','hdftool','help','helpbrowser','helpdesk','helpdlg','helpwin','hess','hex2dec','hex2num','hgexport','hggroup','hgload','hgsave','hgsetget','hgtransform','hidden','hilb','hist','histc','hold','home','horzcat','horzcat','hostid','hsv2rgb','hypot','i','ichol','idealfilter','idivide','ifft','ifft2','ifftn','ifftshift','ilu','im2frame','im2java','imag','image','imagesc','imapprox','imfinfo','imformats','import','importdata','imread','imwrite','incenters','ind2rgb','ind2sub','Inf','inferiorto','info','inline','inmem','inOutStatus','inpolygon','input','inputdlg','inputname','inputParser','inspect','instrcallback','instrfind','instrfindall','int16','int2str','int32','int64','int8','integral','integral2','integral3','interfaces','interp1','interp1q','interp2','interp3','interpft','interpn','interpstreamspeed','intersect','intmax','intmin','inv','invhilb','invoke','ipermute','iqr','is*','isa','isappdata','iscell','iscellstr','ischar','iscolumn','iscom','isdir','isEdge','isempty','isempty','isequal','isequal','isequaln','isequalwithequalnans','isevent','isfield','isfinite','isfloat','isglobal','ishandle','ishghandle','ishold','isinf','isinteger','isinterface','isjava','isKey','iskeyword','isletter','islogical','ismac','ismatrix','ismember','ismethod','ismethod','isnan','isnumeric','isobject','isocaps','isocolors','isonormals','isosurface','ispc','isPlatformSupported','ispref','isprime','isprop','isprop','isreal','isrow','isscalar','issorted','isspace','issparse','isstr','isstrprop','isstruct','isstudent','isTiled','isunix','isvalid','isvalid','isvalid','isvarname','isvector','j','javaaddpath','javaArray','javachk','javaclasspath','javaMethod','javaMethodEDT','javaObject','javaObjectEDT','javarmpath','keyboard','keys','kron','last','lastDirectory','lasterr','lasterror','lastwarn','lcm','ldivide','ldl','le','legend','legendre','length','length','length','libfunctions','libfunctionsview','libisloaded','libpointer','libstruct','license','light','lightangle','lighting','lin2mu','line','LineSpec','linkaxes','linkdata','linkprop','linsolve','linspace','listdlg','listfonts','load','load','load','loadlibrary','loadobj','log','log10','log1p','log2','logical','loglog','logm','logspace','lookfor','lower','ls','lscov','lsqnonneg','lsqr','lt','lu','luinc','magic','makehgtform','mat2cell','mat2str','material','matfile','matlab','matlab','max','MaximizeCommandWindow','maxNumCompThreads','mean','median','memmapfile','memory','menu','mesh','meshc','meshgrid','meshz','methods','methodsview','mex','MException','mexext','mfilename','mget','min','MinimizeCommandWindow','minres','minus','mislocked','mkdir','mkpp','mldivide','mrdivide','mlint','mlintrpt','mlock','mmfileinfo','mmreader','mod','mode','more','move','movefile','movegui','movie','movie2avi','mpower','mput','msgbox','mtimes','mu2lin','multibandread','multibandwrite','munlock','namelengthmax','NaN','nargchk','nargin','narginchk','nargout','nargoutchk','native2unicode','nccreate','ncdisp','nchoosek','ncinfo','ncread','ncreadatt','ncwrite','ncwriteatt','ncwriteschema','ndgrid','ndims','ne','ne','nearestNeighbor','neighbors','NET','netcdf','newplot','nextDirectory','nextpow2','nnz','noanimate','nonzeros','norm','normest','not','notebook','notify','now','nthroot','null','num2cell','num2hex','num2str','numberOfStrips','numberOfTiles','numel','nzmax','ode113','ode15i','ode15s','ode23','ode23s','ode23t','ode23tb','ode45','odeget','odeset','odextend','onCleanup','ones','open','openfig','opengl','openvar','optimget','optimset','or','ordeig','orderfields','ordqz','ordschur','orient','orth','otherwise','pack','padecoef','pagesetupdlg','pan','pareto','parfor','parse','parseSoapResponse','pascal','patch','path','path2rc','pathsep','pathtool','pause','pbaspect','pcg','pchip','pcode','pcolor','pdepe','pdeval','peaks','perl','perms','permute','persistent','pi','pie','pie3','pinv','planerot','play','playblocking','playshow','plot','plot3','plotbrowser','plotedit','plotmatrix','plottools','plotyy','plus','pointLocation','pol2cart','polar','poly','polyarea','polyder','polyeig','polyfit','polyint','polyval','polyvalm','pow2','power','ppval','prefdir','preferences','primes','print','printdlg','printopt','printpreview','prod','profile','profsave','propedit','propedit','properties','propertyeditor','psi','publish','PutCharArray','PutFullMatrix','PutWorkspaceData','pwd','qmr','qr','qrdelete','qrinsert','qrupdate','quad','quad2d','quadgk','quadl','quadv','questdlg','quit','Quit','quiver','quiver3','qz','rand','rand','randi','randi','randn','randn','randperm','randperm','RandStream','rank','rat','rats','rbbox','rcond','rdivide','read','readasync','readEncodedStrip','readEncodedTile','real','reallog','realmax','realmin','realpow','realsqrt','record','recordblocking','rectangle','rectint','recycle','reducepatch','reducevolume','refresh','refreshdata','regexp','regexpi','regexprep','regexptranslate','registerevent','rehash','relationaloperators','release','rem','Remove','remove','RemoveAll','removets','rename','repmat','resample','resample','reset','reset','reshape','residue','restoredefaultpath','rethrow','return','rewriteDirectory','rgb2hsv','rgb2ind','rgbplot','ribbon','rmappdata','rmdir','rmfield','rmpath','rmpref','rng','roots','rose','rosser','rot90','rotate','rotate3d','round','rref','rsf2csf','run','save','save','save','saveas','saveobj','savepath','scatter','scatter3','schur','script','sec','secd','sech','selectmoveresize','semilogx','semilogy','sendmail','serial','serialbreak','set','set','set','set','set','set','set','setabstime','setabstime','setappdata','setdiff','setDirectory','setdisp','setenv','setfield','setinterpmethod','setpixelposition','setpref','setstr','setSubDirectory','setTag','settimeseriesnames','setuniformtime','setxor','shading','shg','shiftdim','showplottool','shrinkfaces','sign','sin','sind','single','sinh','size','size','size','slice','smooth3','snapnow','sort','sortrows','sound','soundsc','spalloc','sparse','spaugment','spconvert','spdiags','specular','speye','spfun','sph2cart','sphere','spinmap','spline','spones','spparms','sprand','sprandn','sprandsym','sprank','sprintf','spy','sqrt','sqrtm','squeeze','ss2tf','sscanf','stairs','start','startat','startup','std','stem','stem3','stop','stopasync','str2double','str2func','str2mat','str2num','strcat','strcmp','strcmpi','stream2','stream3','streamline','streamparticles','streamribbon','streamslice','streamtube','strfind','strings','strjust','strmatch','strncmp','strncmpi','strread','strrep','strtok','strtrim','struct','struct2cell','structfun','strvcat','sub2ind','subplot','subsasgn','subsindex','subspace','subsref','substruct','subvolume','sum','superclasses','superiorto','support','surf','surf2patch','surface','surfc','surfl','surfnorm','svd','svds','swapbytes','symamd','symbfact','symmlq','symrcm','symvar','synchronize','syntax','system','tan','tand','tanh','tar','tempdir','tempname','tetramesh','texlabel','text','textread','textscan','textwrap','tfqmr','throwAsCaller','tic','Tiff','timer','timerfind','timerfindall','times','timeseries','title','toc','todatenum','toeplitz','toolboxdir','trace','transpose','trapz','treelayout','treeplot','tril','trimesh','triplequad','triplot','TriRep','TriScatteredInterp','trisurf','triu','true','tscollection','tsearch','tsearchn','tstool','type','typecast','uibuttongroup','uicontextmenu','uicontrol','uigetdir','uigetfile','uigetpref','uiimport','uimenu','uint16','uint32','uint64','uint8','uiopen','uipanel','uipushtool','uiputfile','uiresume','uisave','uisetcolor','uisetfont','uisetpref','uistack','uitable','uitoggletool','uitoolbar','uiwait','uminus','undocheckout','unicode2native','union','unique','unix','unloadlibrary','unmesh','unmkpp','unregisterallevents','unregisterevent','untar','unwrap','unzip','uplus','upper','urlread','urlwrite','usejava','userpath','validateattributes','validatestring','values','vander','var','varargin','varargout','vectorize','ver','verctrl','verLessThan','version','vertcat','vertcat','vertexAttachments','VideoReader','VideoWriter','view','viewmtx','visdiff','volumebounds','voronoi','voronoiDiagram','voronoin','wait','waitbar','waitfor','waitforbuttonpress','warndlg','warning','waterfall','wavfinfo','wavplay','wavread','wavrecord','wavwrite','web','weekday','what','whatsnew','which','whitebg','who','whos','wilkinson','winopen','winqueryreg','wk1finfo','wk1read','wk1write','workspace','write','writeDirectory','writeEncodedStrip','writeEncodedTile','writeVideo','xlabel','xlim','xlsfinfo','xlsread','xlswrite','xmlread','xmlwrite','xor','xslt','ylabel','ylim','zeros','zip','zlabel','zlim','zoom'])
		kwset.DefineKeywords("color_keyword",['if','else','end','elseif','function','otherwise','switch','case','for','while','break','continue','try','catch','throw','rethrow','true','false'])
		kwset.DefineWordColor("color")
		kwset.DefineWordType("color_number","0-9")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_string])
			if(lang.isInside(bid_comment)||lang.isInside(bid_string)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
		});
	}
});

Language.Register({
	name:'Python',extensions:['py'],
	indent_as_bracelet:1,
	curly_bracket_is_not_special:1,
	rule:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","#","\n","color_comment");
		var bid_string0=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_string1=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'''","'''","color_string");
		var bid_string3=lang.ColoredDelimiter("key",'"""','"""',"color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineKeywords("color_type",['def','lambda','int'])
		kwset.DefineKeywords("color_keyword",['and','del','from','not','while','as','elif','global','or','with','assert','else','if','pass','yield','break','except','import','print','class','exec','in','raise','continue','finally','is','return','for','try','True','False'])
		kwset.DefineWordColor("color")
		kwset.DefineWordType("color_number","0-9")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_string0,bid_string1,bid_string2,bid_string3])
			if(lang.isInside(bid_comment)||lang.isInside(bid_string0)||lang.isInside(bid_string1)||lang.isInside(bid_string2)||lang.isInside(bid_string3)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
		});
	}
});

/////////////////////////////////////////////

UI.RegisterEditorPlugin(function(){
	//enhanced enter
	this.AddEventHandler('\n',function(){
		var ed=this.ed;
		var ccnt=this.GetSelection()[0]
		var ccnt_ehome=Math.min(this.GetEnhancedHome(ccnt),ccnt)
		var ccnt_lhome=this.SeekLC(this.GetLC(ccnt_ehome)[0],0)
		if(!(ccnt_ehome>ccnt_lhome)){return 1;}//don't intercept it
		this.OnTextInput({"text":"\n"+this.ed.GetText(ccnt_lhome,ccnt_ehome-ccnt_lhome),"is_paste":1})
		return 0;
	})
});

UI.RegisterEditorPlugin(function(){
	//tab indent, shift+tab dedent
	if(!this.tab_is_char){return;}
	var indentText=function(delta){
		var ed=this.ed;
		var sel=this.GetSelection();
		if(sel[0]==sel[1]){return 1;}
		var line0=this.GetLC(sel[0])[0];
		var line1=this.GetLC(sel[1])[0];
		if(this.SeekLC(line1,0)<sel[1]){line1++;}
		var line_ccnts=this.SeekAllLinesBetween(line0,line1+1);
		var ops=[];
		for(var i=0;i<line_ccnts.length-1;i++){
			var ccnt0=line_ccnts[i];
			var ccnt1=line_ccnts[i+1];
			if(delta>0){
				ops.push(ccnt0,0,'\t')
			}else{
				if(ccnt0<ccnt1){
					var ch=ed.GetUtf8CharNeighborhood(ccnt0)[1];
					if(ch==32||ch==9){
						ops.push(ccnt0,1,null)
					}
				}
			}
		}
		if(ops.length){
			this.HookedEdit(ops)
			this.CallOnChange()
			UI.Refresh();
			return 0;
		}else{
			return 1;
		}
	}
	this.AddEventHandler('TAB',function(){
		return indentText.call(this,1)
	})
	this.AddEventHandler('SHIFT+TAB',function(){
		return indentText.call(this,-1)
	})
})

UI.RegisterEditorPlugin(function(){
	//alt+pgup/pgdn
	if(this.plugin_class!="code_editor"){return;}
	this.m_outer_scope_queue=[]
	var fouter_scope=function(){
		var ed=this.ed;
		var ccnt_new=this.FindOuterLevel(this.sel1.ccnt);
		if(ccnt_new>=0){
			this.m_outer_scope_queue.push(this.sel1.ccnt)
			this.sel0.ccnt=ccnt_new
			this.sel1.ccnt=ccnt_new
			this.AutoScroll("center_if_hidden");
			UI.Refresh()
			return 0;
		}
		return 1;
	}
	var finner_scope=function(){
		if(this.m_outer_scope_queue.length){
			var ccnt_new=this.m_outer_scope_queue.pop()
			this.sel0.ccnt=ccnt_new
			this.sel1.ccnt=ccnt_new
			this.AutoScroll("center_if_hidden");
			UI.Refresh()
			return 0;
		}
	}
	this.AddEventHandler('ALT+PGUP',fouter_scope)
	this.AddEventHandler('ALT+PGDN',finner_scope)
	this.AddEventHandler('selectionChange',function(){this.m_outer_scope_queue=[];})
	this.AddEventHandler('change',function(){this.m_outer_scope_queue=[];})
	//alt+up/down
	var fscopeup=function(){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(this.sel1.ccnt);
		var ccnt_new=ed.FindNearest(id_indent,[my_level],"l",Math.max(this.sel1.ccnt-1-this.GetLC(this.sel1.ccnt)[1],0),-1);
		if(ccnt_new>=0){
			this.sel0.ccnt=ccnt_new
			this.sel1.ccnt=ccnt_new
			this.AutoScroll("center_if_hidden");
			UI.Refresh()
			return 0;
		}
		return 1
	}
	var fscopedown=function(){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(this.sel1.ccnt);
		var ccnt_new=ed.FindNearest(id_indent,[my_level],"l",this.SeekLC(this.GetLC(this.sel1.ccnt)[0]+1),1);
		if(ccnt_new>=0){
			this.sel0.ccnt=ccnt_new
			this.sel1.ccnt=ccnt_new
			this.AutoScroll("center_if_hidden");
			UI.Refresh()
			return 0;
		}
		return 1
	}
	this.AddEventHandler('ALT+UP',fscopeup)
	this.AddEventHandler('ALT+DOWN',fscopedown)
	/////////////////////////
	this.AddEventHandler('afterRender',function(){
		if(UI.HasFocus(this)){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			menu_search.AddButtonRow({text:"Scope"},[
				{text:"&outer",tooltip:'ALT+PGUP',action:function(){
					fouter_scope.call(doc)
				}},{text:"&inner",tooltip:'ALT+PGDN',action:function(){
					finner_scope.call(doc)
				}}])
			menu_search.AddButtonRow({text:"Lines of the same indentation"},[
				{text:"up",tooltip:'ALT+UP',action:function(){
					fscopeup.call(doc)
				}},{text:"down",tooltip:'ALT+DOWN',action:function(){
					fscopedown.call(doc)
				}}])
			menu_search.AddSeparator();
		}
	})
});

//control up/down
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class=="widget"){return;}
	//ctrl+up/down
	this.AddEventHandler('CTRL+UP',function(){
		this.scroll_y-=this.GetCharacterHeightAtCaret();
		if(!(this.scroll_y>0)){
			this.scroll_y=0;
		}
		UI.Refresh();
		return 0
	})
	this.AddEventHandler('CTRL+DOWN',function(){
		var ed=this.ed
		var ccnt_tot=ed.GetTextSize();
		var ytot=ed.XYFromCcnt(ccnt_tot).y+ed.GetCharacterHeightAt(ccnt_tot);
		var hc=this.GetCharacterHeightAtCaret();
		var page_height=this.h;
		this.scroll_y=Math.min(this.scroll_y+hc,ytot-page_height);
		UI.Refresh();
		return 0
	})
});

//bookmarking
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	//the numbered guys
	for(var i=0;i<10;i++){
		(function(i){
			this.AddEventHandler('CTRL+SHIFT+'+i.toString(),function(){
				var ed=this.ed;
				var ccnt=this.sel1.ccnt;
				if(!this.m_bookmarks[i]){
					this.m_bookmarks[i]=ed.CreateLocator(ccnt,-1)
				}else{
					if(this.m_bookmarks[i].ccnt==ccnt){
						this.m_bookmarks[i].discard();
						this.m_bookmarks[i]=undefined;
					}else{
						this.m_bookmarks[i].ccnt=ccnt
					}
				}
				UI.Refresh()
				return 0;
			});
			this.AddEventHandler('CTRL+'+i.toString(),function(){
				var ed=this.ed;
				var ccnt=this.sel1.ccnt;
				if(this.m_bookmarks[i]){
					this.sel0.ccnt=this.m_bookmarks[i].ccnt
					this.sel1.ccnt=this.m_bookmarks[i].ccnt
					this.AutoScroll("center_if_hidden");
					UI.Refresh()
					return 0
				}
				return 1;
			});
		}).call(this,i)
	}
	//the unmarked guys
	this.AddEventHandler('CTRL+SHIFT+Q',function(){
		var ed=this.ed;
		var ccnt=this.sel1.ccnt;
		var bm0=this.FindNearestBookmark(ccnt,1)
		if(bm0&&bm0.ccnt==ccnt){
			this.DeleteBookmark(bm0)
		}else{
			this.m_unkeyed_bookmarks.push(ed.CreateLocator(ccnt,-1))
		}
		UI.Refresh()
		return 0;
	});
	this.AddEventHandler('F2',function(){
		var ccnt=this.sel1.ccnt;
		var bm=this.FindNearestBookmark(ccnt+1,1)
		if(!bm){return 1;}
		this.sel0.ccnt=bm.ccnt
		this.sel1.ccnt=bm.ccnt
		this.AutoScroll("center_if_hidden");
		UI.Refresh()
		return 0;
	})
	this.AddEventHandler('SHIFT+F2',function(){
		var ccnt=this.sel1.ccnt;
		var bm=this.FindNearestBookmark(ccnt-1,-1)
		if(!bm){return 1;}
		this.sel0.ccnt=bm.ccnt
		this.sel1.ccnt=bm.ccnt
		this.AutoScroll("center_if_hidden");
		UI.Refresh()
		return 0;
	})
});

////////////////////////////////////
//C-like
var MatchingBracket=function(c){
	if(c=='('){return ')';}
	if(c=='['){return ']';}
	if(c=='{'){return '}';}
	if(c=='<'){return '>';}
	if(c==')'){return '(';}
	if(c==']'){return '[';}
	if(c=='}'){return '{';}
	if(c=='>'){return '<';}
	return c
}

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	if(!this.plugin_language_desc||this.plugin_language_desc.name=="Plain text"){return;}
	//bracket auto-matching with bold hl
	this.AddEventHandler('editorCreate',function(){
		var hl_items=this.CreateTransientHighlight({
			'depth':1,
			'color':this.color,
			'display_mode':UI.HL_DISPLAY_MODE_EMBOLDEN,
			'invertible':0,
		});
		this.m_lbracket_p0=hl_items[0]
		this.m_lbracket_p1=hl_items[1]
		this.m_lbracket_hl=hl_items[2]
		hl_items=this.CreateTransientHighlight({
			'depth':1,
			'color':this.color,
			'display_mode':UI.HL_DISPLAY_MODE_EMBOLDEN,
			'invertible':0,
		});
		this.m_rbracket_p0=hl_items[0]
		this.m_rbracket_p1=hl_items[1]
		this.m_rbracket_hl=hl_items[2]
	})
	var HighlightBrackets=function(doc,ccnt0,ccnt1){
		doc.m_lbracket_p0.ccnt=ccnt0
		doc.m_lbracket_p1.ccnt=ccnt0+1
		doc.m_rbracket_p0.ccnt=ccnt1
		doc.m_rbracket_p1.ccnt=ccnt1+1
		UI.Refresh()
	}
	var fcheckbrackets=function(){
		var ccnt=this.sel1.ccnt
		var lang=this.plugin_language_desc
		if(this.IsBracketEnabledAt(ccnt)){
			//what constitutes a bracket, state
			var is_left_bracket=0
			for(var i=0;i<lang.m_lbracket_tokens.length;i++){
				var s=lang.m_lbracket_tokens[i]
				var lg=Duktape.__byte_length(s)
				if(this.ed.GetText(ccnt-lg,lg)==s){
					//left bracket
					is_left_bracket=1;
					break
				}
			}
			if(is_left_bracket){
				var ccnt2=this.FindOuterBracket(ccnt,1)
				if(ccnt2>=0){
					HighlightBrackets(this,ccnt-1,ccnt2-1)
					return
				}
			}
			var is_right_bracket=0;
			for(var i=0;i<lang.m_rbracket_tokens.length;i++){
				var s=lang.m_rbracket_tokens[i]
				var lg=Duktape.__byte_length(s)
				if(this.ed.GetText(ccnt,lg)==s){
					//left bracket
					is_right_bracket=1;
					break
				}
			}
			if(is_right_bracket){
				var ccnt2=this.FindOuterBracket(ccnt,-1)
				if(ccnt2>=0){
					HighlightBrackets(this,ccnt2,ccnt)
					return
				}
			}
		}
		this.m_lbracket_p0.ccnt=0
		this.m_lbracket_p1.ccnt=0
		this.m_rbracket_p0.ccnt=0
		this.m_rbracket_p1.ccnt=0
		//sth like IsBracketEnabled, m_lbracket_tokens, m_rbracket_tokens
		//return ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"lll")[1];
	}
	this.AddEventHandler('selectionChange',fcheckbrackets)
	this.AddEventHandler('change',fcheckbrackets)
	var goto_matching_bracket=function(is_sel){
		var ccnt=this.sel1.ccnt
		if(!(this.m_lbracket_p0.ccnt<this.m_lbracket_p1.ccnt)){
			//coulddo: notification
			return;
		}
		var ccnt_new;
		if(ccnt==this.m_lbracket_p0.ccnt||ccnt==this.m_lbracket_p1.ccnt){
			ccnt_new=this.m_rbracket_p0.ccnt;
		}else if(ccnt==this.m_rbracket_p0.ccnt||ccnt==this.m_rbracket_p1.ccnt){
			ccnt_new=this.m_lbracket_p1.ccnt;
		}else{
			UI.assert(0,"panic: bracket highlight enabled but cursor not at bracket?")
			return;
		}
		this.sel0.ccnt=is_sel?ccnt:ccnt_new
		this.sel1.ccnt=ccnt_new
		UI.Refresh()
	}
	this.AddEventHandler('afterRender',function(){
		var enabled=(this.m_lbracket_p0.ccnt<this.m_lbracket_p1.ccnt)
		if(UI.HasFocus(this)&&enabled){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			menu_search.AddButtonRow({text:"Parenthesis"},[
				{text:"&match",tooltip:'SHIFT+CTRL+P',action:function(){
					goto_matching_bracket.call(doc,0)
				}},{text:"&select to",tooltip:'CTRL+P',action:function(){
					goto_matching_bracket.call(doc,1)
				}}])
			menu_search.AddSeparator();
		}
	})
	this.AddEventHandler('CTRL+SHIFT+P',function(){goto_matching_bracket.call(this,0)})
	this.AddEventHandler('CTRL+P',function(){goto_matching_bracket.call(this,1)})
});

var bracket_context_prototype={
	PopBacStack:function(){
		if(this.current_bracket_ac_ccnt_range){
			var rg=this.current_bracket_ac_ccnt_range
			for(var i=0;i<rg.length;i++){
				rg[i].discard();
			}
		}
		if(this.bac_stack.length){
			this.current_bracket_ac=this.bac_stack.pop()
			this.current_bracket_ac_bralevel=this.bac_stack.pop()
			this.current_bracket_ac_ccnt_range=this.bac_stack.pop()
		}else{
			this.current_bracket_ac=0
			this.current_bracket_ac_bralevel=0
			this.current_bracket_ac_ccnt_range=undefined
		}
	}
}
UI.RegisterEditorPlugin(function(){
	this.m_bracket_ctx={
		bac_stack:[],
		isin:0,
		current_bracket_ac:0,
		current_bracket_ac_bralevel:0,
		detecting_bad_curly:0,
		current_bracket_ac_ccnt_range:undefined,
		bad_curly_locator:0,
	}
	Object.setPrototypeOf(this.m_bracket_ctx,bracket_context_prototype)
	////////////
	//this.AddEventHandler('editorCreate',function(){
	//	var ed=this.ed;
	//	var ctx=this.m_bracket_ctx;
	//	ctx.current_bracket_ac_ccnt_range=[ed.CreateLocator(0,-1),ed.CreateLocator(0,-1)]
	//	ctx.bad_curly_locator=ed.CreateLocator(0,-1)
	//})
	//we need a *stack* of locators
	this.AddEventHandler('change',function(){
		var ctx=this.m_bracket_ctx;
		if(ctx.detecting_bad_curly){
			ctx.detecting_bad_curly=0
		}
	})
	this.AddEventHandler('}',function(){
		var ctx=this.m_bracket_ctx;
		if(ctx.detecting_bad_curly){
			var ccnt_pos=this.sel1.ccnt
			var bad_curly_ac_ccnt=ctx.bad_curly_locator.ccnt+1
			//{ + move away + }
			//the pair have to be would-be matches: level test, after-ness test
			var blevel=this.GetBracketLevel(ccnt_pos)
			if(ccnt_pos>bad_curly_ac_ccnt&&blevel==this.GetBracketLevel(bad_curly_ac_ccnt)-1){
				//the final left-bra test
				var ccnt_left_bra=this.FindBracket(blevel-1,ccnt_pos,-1)
				if(ccnt_left_bra<bad_curly_ac_ccnt&&ed.GetUtf8CharNeighborhood(bad_curly_ac_ccnt)[1]=='}'){
					//we should indeed cancel out the previous }
					//but any auto-completion should continue normally
					var sel=this.GetSelection()
					var ops=[bad_curly_ac_ccnt,1,null, sel[0],sel[1]-sel[0],'}']
					ed.Edit(ops)
					this.sel0.ccnt=sel[0]-1
					this.sel1.ccnt=sel[0]-1
					return 0
				}
			}
		}
		return 1
	})
	this.AddEventHandler('selectionChange',function(){
		var lang=this.plugin_language_desc
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel_new=this.GetSelection()
		var ccntmin=sel_new[0]
		var ccntmax=sel_new[1]
		for(;ctx.current_bracket_ac_ccnt_range;){
			var ccnt_range0=ctx.current_bracket_ac_ccnt_range[0].ccnt
			var ccnt_range1=ctx.current_bracket_ac_ccnt_range[1].ccnt
			if(ccntmin<=ccnt_range0||ccntmax>=ccnt_range1){
				if(ctx.bac_stack.length==0&&ctx.current_bracket_ac=='}'&&!lang.curly_bracket_is_not_special){
					ctx.detecting_bad_curly=1
					ctx.bad_curly_locator=ctx.current_bracket_ac_ccnt_range[0]
				}
				ctx.PopBacStack()
			}else{
				break
			}
		}
	})
	this.AddEventHandler('BACKSPACE',function(){
		//left deletion: delete both ends
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel_new=this.GetSelection()
		var ccnt0=sel_new[0]
		var ccnt1=sel_new[1]
		if(ctx.current_bracket_ac_ccnt_range&&ccnt0==ccnt1&&ccnt1==ctx.current_bracket_ac_ccnt_range[0].ccnt+1){
			if(ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt){
				var ccnt_lbra=ccnt1-1
				ed.Edit([ccnt_lbra,2,null])
				this.sel0.ccnt=ccnt_lbra
				this.sel1.ccnt=ccnt_lbra
				ctx.PopBacStack()
				return 0
			}
		}
		return 1
	})
	this.AddEventHandler('RETURN RETURN2',function(){
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel_new=this.GetSelection()
		var ccnt0=sel_new[0]
		var ccnt1=sel_new[1]
		if(ccnt0==ccnt1&&ctx.current_bracket_ac_ccnt_range&&ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt){
			//pop everything and move past them before entering
			var lang=this.plugin_language_desc
			for(;ctx.current_bracket_ac_ccnt_range&&ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt;){
				//{} case - don't pop it, also {} vs python
				if(ctx.current_bracket_ac=='}'&&!lang.curly_bracket_is_not_special){
					break;
				}
				var ccnt1=ctx.current_bracket_ac_ccnt_range[1].ccnt
				PopBacStack()
			}
			if(this.IsLineEndAt(ccnt1)){
				//only move if we're at the line end
				this.sel0.ccnt=ccnt1
				this.sel1.ccnt=ccnt1
				//go ahead and do it
				return 1
			}
		}
		return 1
	})
	var listening_keys=["{","[","(","'","\"","$",")","]","}"]
	var f_key_test=function(C){
		var lang=this.plugin_language_desc
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		if(C=="{"||C=="["||C=="("||((C=="'"&&!lang.is_tex_like||C=='$'&&lang.is_tex_like||C=="\"")&&C!=ctx.current_bracket_ac)){
			var chbraac=MatchingBracket(C)
			var ccnt_pos=this.sel1.ccnt
			var ch_neibs=ed.GetUtf8CharNeighborhood(ccnt_pos)
			var chprev=ch_neibs[0]
			var chnext=ch_neibs[1]
			if(chbraac){
				if(this.IsLeftBracket(String.fromCharCode(C))&&chbraac!="'"&&chbraac!="\""&&chbraac!="$"){
					//the syntax has to actually consider it as a bracket, or it has to be a quote
					chbraac=0;
				}else if(!this.IsBracketEnabledAt(ccnt_pos)){
					//the state has to allow brackets
					chbraac=0
				}
			}
			if(chbraac){
				//other-half-mismatch test
				var is_lineend=this.IsLineEndAt(ccnt_pos)
				var is_manual_match=0
				if(ctx.bac_stack.length){
					//only the topmost level should check for the match
					is_manual_match=0
				}else if(chbraac=='}'&&!lang.indent_as_bracelet){
					is_manual_match=0;
				}else{
					var blevel=this.GetBracketLevel(ccnt_pos)
					var ccnt_rbra=this.FindBracket(blevel-1,ccnt_pos,1)
					is_manual_match=(ccnt_rbra>=0&&ed.GetUtf8CharNeighborhood(ccnt_rbra)[1]==chbraac)
				}
				//smarter auto (): clearly fcall-ish case
				var ccnt_next_nonspace=ed.MoveToBoundary(ccnt_pos,1,"space")
				var chnext_nonspace=ed.GetUtf8CharNeighborhood(ccnt_next_nonspace)[1]
				var is_fcall_like=0
				//([{
				if('+-*/|&^%<>.?:,;\r\n)]}'.indexOf(chnext_nonspace)>=0&&chnext_nonspace!=C&&UI.IsWordChar(chprev)&&this.m_user_just_typed_char){
					//after-id-and-before-sym-case, and the id is just typed, most likely a func call or sth
					is_fcall_like=1
					//avoid ++ --
					if(chnext_nonspace=='+'.charCodeAt(0)||chnext_nonspace=='-'.charCodeAt(0)){
						if(ed.GetChar(ccnt_next_nonspace+1)==chnext_nonspace){
							is_fcall_like=0
						}
					}
					//avoid * & in C
					if(lang.has_pointer_ops&&(chnext_nonspace=='*'.charCodeAt(0)||chnext_nonspace=='&'.charCodeAt(0))){
						is_fcall_like=0
					}
					//avoid . in BSGP/SPAP
					if(lang.has_dlist_type&&chnext_nonspace=='.'){
						is_fcall_like=0
					}
				}
				if(is_lineend&&!is_manual_match||ctx.current_bracket_ac_ccnt_range&&ccnt_pos+1==ctx.current_bracket_ac_ccnt_range[1].ccnt||is_fcall_like){
					if(ctx.current_bracket_ac){
						ctx.bac_stack.push(ctx.current_bracket_ac_ccnt_range)
						ctx.bac_stack.push(ctx.current_bracket_ac_bralevel)
						ctx.bac_stack.push(ctx.current_bracket_ac)
					}
					//.just_typed_bra=0//for func hint purposes
					var str=C+chbraac;
					var sel=this.GetSelection()
					ctx.current_bracket_ac=chbraac
					ccnt_pos=sel[0]
					if(lang.is_tex_like){
						//\left completion
						if(C=="{"){
							if(ccnt_pos>=1&&ed.GetText(ccnt_pos-1,1)=="\\"){
								str=C+"\\"+chbraac;
							}
							if(ccnt_pos>=6&&ed.GetText(ccnt_pos-6,6)=="\\left\\"){
								str=C+"\\right\\"+chbraac
							}
						}else{
							if(ccnt_pos>=5&&ed.GetText(ccnt_pos-5,5)=="\\left"){
								str=C+"\\right"+chbraac
							}
						}
					}
					ed.Edit([sel[0],sel[1]-sel[0],str])
					//only record the starting ccnt
					ctx.current_bracket_ac_ccnt_range=[ed.CreateLocator(ccnt_pos,-1), ed.CreateLocator(ccnt_pos+Duktape.__byte_length(str),1), ed.CreateLocator(ccnt_pos+Duktape.__byte_length(C),1)]
					//get the level AFTER insertion
					var ccnt_mid=ccnt_pos+Duktape.__byte_length(C)//len(str)-1
					ctx.current_bracket_ac_bralevel=this.GetBracketLevel(ccnt_mid)
					this.sel0.ccnt=ccnt_mid
					this.sel1.ccnt=ccnt_mid
					var hlobj=ed.CreateHighlight(ctx.current_bracket_ac_ccnt_range[2],ctx.current_bracket_ac_ccnt_range[1],-1)
					hlobj.color=this.color_completing_bracket;
					hlobj.invertible=0;
					ctx.current_bracket_ac_ccnt_range.push(hlobj)
					//ed.trigger_data.bracket_completed=C//tex \ref or \cite... don't need this
					ctx.detecting_bad_curly=0
					return 0
				}
			}
			return 1
		}
		if(C==ctx.current_bracket_ac){
			var ccnt1=this.sel1.ccnt
			if(ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt&&this.sel0.ccnt==ccnt1){
				var sel=this.GetSelection()
				ed.BeginUndoBatch()
				ed.DeleteSelection()
				ed.Edit([ccnt,1,C])
				ctx.PopBacStack()
				return 0
			}
			return 1
		}
		return 1
	}
	for(var i=0;i<listening_keys.length;i++){
		var C=listening_keys[i];
		(function(C){
			this.AddEventHandler(C,function(){return f_key_test.call(this,C)})
		}).call(this,C);
	}
});
