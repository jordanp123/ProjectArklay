package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;
public class Simple_Electrical extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_simple__electrical);
    }
    public float format(EditText input)//takes input of EditText from Textbox and converts to float.
    {
        float result=0;
        String Box4str=input.getText().toString();
        if(Box4str != null && !Box4str.isEmpty())
        {
            result = Float.parseFloat(Box4str);
        }
        return result;
    }
    public void SinglePhasePowerFlow(View v)//S=VI* or S*/V*=I
    {
        double apparentpower=1;
        double resistance=1;
        double reactance=1;
        double powerfactor=1;
        double SVoltage=1;
        double watts=1;
        double vars=1;
        double result=1;
        apparentpower=format((EditText)findViewById(R.id.editText7));
        resistance=format((EditText)findViewById(R.id.editText8));
        reactance=format((EditText)findViewById(R.id.editText9));
        powerfactor=format((EditText)findViewById(R.id.editText13));
        SVoltage=format((EditText)findViewById(R.id.editText12));

        resistance=resistance*2;
        reactance=reactance*2;

        watts=apparentpower*powerfactor; //Using basic definition of Power Factor.
        vars=apparentpower*Math.sin(Math.acos(powerfactor));

        Complex impedance = new Complex(resistance,reactance);
        Complex ComplexPower=new Complex(watts,vars);
        Complex RVoltage = new Complex(SVoltage,0);
        Complex SendingVoltage = new Complex(SVoltage,0);
        Complex temp1;
        Complex temp2;
        Complex Vdrop;
        Complex Ic;
        for (int x=0;x<300;x++)
        {
            temp1=ComplexPower.conjugate(); //S*
            temp2= RVoltage.conjugate(); //V*  Vf=Vi-Z(S*/Vn*)
            Ic=temp1.divides(temp2); //   Z*(S*/Vn*)
            Vdrop=impedance.times(Ic);//Z*(S*/Vn*)
            if (RVoltage.abs()>SendingVoltage.abs())  //Checking for To much load.
            {
                x=305; //Break loop.
                Toast.makeText(Simple_Electrical.this,"Calculation Nonsensical",Toast.LENGTH_LONG).show();
            }
            RVoltage=SendingVoltage.minus(Vdrop);
        }
        result= RVoltage.abs();
        Toast.makeText(Simple_Electrical.this,""+result+" Volts",Toast.LENGTH_LONG).show();
    }
    public void OhmsLaw(View v) //Toast View Method Works without Issue.

    {
     //   EditText edittext=(EditText)findViewById(R.id.editText4);
       // String editTextStr = edittext.getText().toString();
        //float volts=Float.parseFloat(editTextStr);
        //Toast.makeText(Simple_Electrical.this,""+volts, Toast.LENGTH_LONG).show();
        float volts=1;
        float impedance=1;
        float amps=1;
        float result=0;
        EditText Box4=(EditText)findViewById(R.id.editText4); //Getting the Voltage Box Info
        String Box4str=Box4.getText().toString();
        if(Box4str != null && !Box4str.isEmpty())
        {
             volts = Float.parseFloat(Box4str);
        }

        EditText Box5=(EditText)findViewById(R.id.editText5);
        String Box5str=Box5.getText().toString();
        if(Box5str !=null && !Box5str.isEmpty())
        {
             impedance = Float.parseFloat(Box5str);
        }
        EditText Box6=(EditText)findViewById(R.id.editText6);
        String Box6str=Box6.getText().toString();
        if (Box6str != null && !Box6str.isEmpty())
        {
             amps = Float.parseFloat(Box6str);
        }

        if((Box4str != null && !Box4str.isEmpty()) && (Box5str != null && !Box5str.isEmpty()))
        {
             result=volts/impedance;
            Toast.makeText(Simple_Electrical.this,""+result+ "A", Toast.LENGTH_LONG).show();

        }
        else if((Box5str != null && !Box5str.isEmpty()) && (Box6str != null && !Box6str.isEmpty()))
        {
            result=impedance*amps;
            Toast.makeText(Simple_Electrical.this,""+result+"V",Toast.LENGTH_LONG).show();
        }
        else if((Box6str != null && !Box6str.isEmpty()) && (Box4str != null && !Box4str.isEmpty()))
        {
            result=volts/amps;
            Toast.makeText(Simple_Electrical.this,""+result+" Ohms",Toast.LENGTH_LONG).show();
        }
        }
    }


