package arklay.quickcalc;

/**
 * Created by Jordan on 10/13/2015.
 */

//Computes the impedance values for cables based on three parameters.
public  class CableValues {
     private Double real=0.0;
     private Double imag=0.0;
    public Complex impedance(int x,int y,int t)//X for size, Y for Shielded, T for Type.
    {

        Complex result =new Complex(real,imag);
        return result;
    }



}
