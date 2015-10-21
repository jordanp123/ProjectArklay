package arklay.quickcalc;


//int x is the AWG with any / removed,Y is 0 if unshielded 1 if shielded,
// t is zero for portable power cables, t is one for mine power feeder cables.
    //KV tells us the voltage class.
//Computes the impedance values for cables based on four parameters.
    //All cables assumed to be 90C cables.
public  class CableValues {
     private Double real=0.0;
     private Double imag=0.0;
    public Complex impedance(int x,int y,int t,int KV)//X for size, Y for Shielded, T for Type.
    {

        if (x==8 && y==0 && t==0 && KV==2) {
            real =.838;
            imag=.034;
        }
        else if (x==7 && y==0 && t==0 && KV==2) {
            real =.696;
            imag=.033;
        }
        else if (x==6 && y==0 && t==0 && KV==2) {
            real =.552;
            imag=.032;
        }
        else if (x==5 && y==0 && t==0 && KV==2) {
            real =.438;
            imag=.031;
        }
        else if (x==4 && y==0 && t==0 && KV==2) {
            real =.347;
            imag=.031;
        }
        else if (x==3 && y==0 && t==0 && KV==2) {
            real =.275;
            imag=.031;
        }
        else if (x==2 && y==0 && t==0 && KV==2) {
            real =.218;
            imag=.029;
        }
        else if (x==1 && y==0 && t==0 && KV==2) {
            real =.173;
            imag=.030;
        }
        else if (x==10 && y==0 && t==0 && KV==2) {
            real =.134;
            imag=.029;
        }
        else if (x==20 && y==0 && t==0 && KV==2) {
            real =.107;
            imag=.029;
        }
        else if (x==30 && y==0 && t==0 && KV==2) {
            real =.085;
            imag=.028;
        }
        else if (x==40 && y==0 && t==0 && KV==2) {
            real =.068;
            imag=.027;
        }
        else if (x==250 && y==0 && t==0 && KV==2) {
            real =.057;
            imag=.028;
        }
        else if (x==300 && y==0 && t==0 && KV==2) {
            real =.048;
            imag=.027;
        }
        else if (x==350 && y==0 && t==0 && KV==2) {
            real =.041;
            imag=.027;
        }
        else if (x==400 && y==0 && t==0 && KV==2) {
            real =.036;
            imag=.027;
        }
        else if (x==500 && y==0 && t==0 && KV==2) {
            real =.029;
            imag=.026;
        }
        else if (x==600 && y==0 && t==0 && KV==2) {
            real =.024;
            imag=.026;
        }
        else if (x==700 && y==0 && t==0 && KV==2) {
            real =.021;
            imag=.026;
        }

        else if (x==800 && y==0 && t==0 && KV==2) {
            real =.019;
            imag=.025;
        }
        else if (x==900 && y==0 && t==0 && KV==2) {
            real =.017;
            imag=.025;
        }
        else if (x==1000 && y==0 && t==0 && KV==2) {
            real =.015;
            imag=.025;
        } //End of 2KV Unshielded.


        else if (x==6 && y==1 && t==0 && KV==2) {
            real =.552;
            imag=.038;
        }
        else if (x==5 && y==1 && t==0 && KV==2) {
            real =.438;
            imag=.036;
        }
        else if (x==4 && y==1 && t==0 && KV==2) {
            real =.347;
            imag=.035;
        }
        else if (x==3 && y==1 && t==0 && KV==2) {
            real =.275;
            imag=.034;
        }
        else if (x==2 && y==1 && t==0 && KV==2) {
            real =.218;
            imag=.033;
        }
        else if (x==1 && y==1 && t==0 && KV==2) {
            real =.173;
            imag=.033;
        }
        else if (x==10 && y==1 && t==0 && KV==2) {
            real =.134;
            imag=.032;
        }
        else if (x==20 && y==1 && t==0 && KV==2) {
            real =.107;
            imag=.031;
        }
        else if (x==30 && y==1 && t==0 && KV==2) {
            real =.085;
            imag=.030;
        }
        else if (x==40 && y==1 && t==0 && KV==2) {
            real =.068;
            imag=.029;
        }
        else if (x==250 && y==1 && t==0 && KV==2) {
            real =.057;
            imag=.030;
        }
        else if (x==300 && y==1 && t==0 && KV==2) {
            real =.048;
            imag=.029;
        }
        else if (x==350 && y==1 && t==0 && KV==2) {
            real =.041;
            imag=.029;
        }
        else if (x==400 && y==1 && t==0 && KV==2) {
            real =.036;
            imag=.028;
        }
        else if (x==500 && y==1 && t==0 && KV==2) {
            real =.029;
            imag=.028;
        }
        else if (x==600 && y==1 && t==0 && KV==2) {
            real =.024;
            imag=.027;
        }
        else if (x==700 && y==1 && t==0 && KV==2) {
            real =.021;
            imag=.027;
        }

        else if (x==800 && y==1 && t==0 && KV==2) {
            real =.019;
            imag=.026;
        }
        else if (x==900 && y==1 && t==0 && KV==2) {
            real =.017;
            imag=.026;
        }
        else if (x==1000 && y==1 && t==0 && KV==2) {
            real =.015;
            imag=.026;
        } //End of 2KV shielded.
    //Beginning of 5KV shielded.
        else if (x==6 && y==1 && t==0 && KV==5) {
            real =.552;
            imag=.043;
        }
        else if (x==5 && y==1 && t==0 && KV==5) {
            real =.438;
            imag=.042;
        }
        else if (x==4 && y==1 && t==0 && KV==5) {
            real =.347;
            imag=.040;
        }
        else if (x==3 && y==1 && t==0 && KV==5) {
            real =.275;
            imag=.039;
        }
        else if (x==2 && y==1 && t==0 && KV==5) {
            real =.218;
            imag=.038;
        }
        else if (x==1 && y==1 && t==0 && KV==5) {
            real =.173;
            imag=.036;
        }
        else if (x==10 && y==1 && t==0 && KV==5) {
            real =.134;
            imag=.035;
        }
        else if (x==20 && y==1 && t==0 && KV==5) {
            real =.107;
            imag=.034;
        }
        else if (x==30 && y==1 && t==0 && KV==5) {
            real =.085;
            imag=.033;
        }
        else if (x==40 && y==1 && t==0 && KV==5) {
            real =.068;
            imag=.032;
        }
        else if (x==250 && y==1 && t==0 && KV==5) {
            real =.057;
            imag=.031;
        }
        else if (x==300 && y==1 && t==0 && KV==5) {
            real =.048;
            imag=.031;
        }
        else if (x==350 && y==1 && t==0 && KV==5) {
            real =.041;
            imag=.030;
        }
        else if (x==400 && y==1 && t==0 && KV==5) {
            real =.036;
            imag=.030;
        }
        else if (x==500 && y==1 && t==0 && KV==5) {
            real =.029;
            imag=.029;
        }
        else if (x==600 && y==1 && t==0 && KV==5) {
            real =.024;
            imag=.028;
        }
        else if (x==700 && y==1 && t==0 && KV==5) {
            real =.021;
            imag=.028;
        }

        else if (x==800 && y==1 && t==0 && KV==5) {
            real =.019;
            imag=.028;
        }
        else if (x==900 && y==1 && t==0 && KV==5) {
            real =.017;
            imag=.027;
        }
        else if (x==1000 && y==1 && t==0 && KV==5) {
            real =.015;
            imag=.027;
        } //End of 5KV shielded.
        //Beginning of 8KV shielded.
        else if (x==4 && y==1 && t==0 && KV==8) {
            real =.347;
            imag=.043;
        }
        else if (x==3 && y==1 && t==0 && KV==8) {
            real =.275;
            imag=.042;
        }
        else if (x==2 && y==1 && t==0 && KV==8) {
            real =.218;
            imag=.040;
        }
        else if (x==1 && y==1 && t==0 && KV==8) {
            real =.173;
            imag=.039;
        }
        else if (x==10 && y==1 && t==0 && KV==8) {
            real =.134;
            imag=.037;
        }
        else if (x==20 && y==1 && t==0 && KV==8) {
            real =.107;
            imag=.036;
        }
        else if (x==30 && y==1 && t==0 && KV==8) {
            real =.085;
            imag=.035;
        }
        else if (x==40 && y==1 && t==0 && KV==8) {
            real =.068;
            imag=.034;
        }
        else if (x==250 && y==1 && t==0 && KV==8) {
            real =.057;
            imag=.033;
        }
        else if (x==300 && y==1 && t==0 && KV==8) {
            real =.048;
            imag=.032;
        }
        else if (x==350 && y==1 && t==0 && KV==8) {
            real =.041;
            imag=.032;
        }
        else if (x==400 && y==1 && t==0 && KV==8) {
            real =.036;
            imag=.031;
        }
        else if (x==500 && y==1 && t==0 && KV==8) {
            real =.029;
            imag=.030;
        }
        else if (x==600 && y==1 && t==0 && KV==8) {
            real =.024;
            imag=.030;
        }
        else if (x==700 && y==1 && t==0 && KV==8) {
            real =.021;
            imag=.029;
        }

        else if (x==800 && y==1 && t==0 && KV==8) {
            real =.019;
            imag=.029;
        }
        else if (x==900 && y==1 && t==0 && KV==8) {
            real =.017;
            imag=.028;
        }
        else if (x==1000 && y==1 && t==0 && KV==8) {
            real =.015;
            imag=.028;
        } //End of 8KV shielded.
        //Beginning of 15KV Shielded.
        else if (x==2 && y==1 && t==0 && KV==15) {
            real =.218;
            imag=.044;
        }
        else if (x==1 && y==1 && t==0 && KV==15) {
            real =.173;
            imag=.042;
        }
        else if (x==10 && y==1 && t==0 && KV==15) {
            real =.134;
            imag=.040;
        }
        else if (x==20 && y==1 && t==0 && KV==15) {
            real =.107;
            imag=.039;
        }
        else if (x==30 && y==1 && t==0 && KV==15) {
            real =.085;
            imag=.038;
        }
        else if (x==40 && y==1 && t==0 && KV==15) {
            real =.068;
            imag=.036;
        }
        else if (x==250 && y==1 && t==0 && KV==15) {
            real =.057;
            imag=.036;
        }
        else if (x==300 && y==1 && t==0 && KV==15) {
            real =.048;
            imag=.035;
        }
        else if (x==350 && y==1 && t==0 && KV==15) {
            real =.041;
            imag=.034;
        }
        else if (x==400 && y==1 && t==0 && KV==15) {
            real =.036;
            imag=.033;
        }
        else if (x==500 && y==1 && t==0 && KV==15) {
            real =.029;
            imag=.032;
        }
        else if (x==600 && y==1 && t==0 && KV==15) {
            real =.024;
            imag=.032;
        }
        else if (x==700 && y==1 && t==0 && KV==15) {
            real =.021;
            imag=.031;
        }

        else if (x==800 && y==1 && t==0 && KV==15) {
            real =.019;
            imag=.030;
        }
        else if (x==900 && y==1 && t==0 && KV==15) {
            real =.017;
            imag=.030;
        }
        else if (x==1000 && y==1 && t==0 && KV==15) {
            real =.015;
            imag=.030;
        } //End of 15KV shielded.
        //Beginning of 25KV Shielded.

        Complex result =new Complex(real,imag);
        return result;
    }



}
