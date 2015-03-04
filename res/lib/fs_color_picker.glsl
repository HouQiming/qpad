void main(){
	vec4 C=Ci;
	if(is_hsv>0.0){
		//hsv to rgb
		float h=C.x,s=C.y,v=C.z;
		float i,f,p,q,t;
		h *= 6.0;			// sector 0 to 5
		i = floor( h );
		f = h - i;			// factorial part of h
		p = v * ( 1.0 - s );
		q = v * ( 1.0 - s * f );
		t = v * ( 1.0 - s * ( 1.0 - f ) );
		if(i==0.0){
			C.xyz=vec3(v,t,p);
		}else if(i==1.0){
			C.xyz=vec3(q,v,p);
		}else if(i==2.0){
			C.xyz=vec3(p,v,t);
		}else if(i==3.0){
			C.xyz=vec3(p,q,v);
		}else if(i==4.0){
			C.xyz=vec3(t,p,v);
		}else{
			C.xyz=vec3(v,p,q);
		}
	}
	if(srgb_supported>0.0){
		C.xyz=pow(C.xyz,vec3(srgb_gamma));
	}
	gl_FragColor=C;
}
