package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.RadioButton;

public class Cable_Calculator extends AppCompatActivity
{

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cable__calculator);
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

    public void Calculate(View v)
    {  //Put display of calculation here.
        //Complex test =CableValues.impedance(7,0,0,2);
       // Toast.makeText(Cable_Calculator.this, "" + test.re() + "Ohms", Toast.LENGTH_LONG).show();
        int shielded=100;
        int CableType=100;
        int Insulation=100;
        int Wiresize=100;
        RadioButton Portable = (RadioButton)findViewById(R.id.Portable);
        RadioButton Feeder = (RadioButton)findViewById(R.id.Feeder);
        RadioButton Shielded = (RadioButton)findViewById(R.id.Shielded);
        RadioButton Unshielded = (RadioButton)findViewById(R.id.UnShielded);
        RadioButton TwoKV = (RadioButton)findViewById(R.id.twoKV);
        RadioButton FiveKV = (RadioButton)findViewById(R.id.fiveKV);
        RadioButton EightKV = (RadioButton)findViewById(R.id.eightKV);
        RadioButton FifteenKV = (RadioButton)findViewById(R.id.fifteenKV);
        RadioButton TwentyfiveKV = (RadioButton)findViewById(R.id.twentyfiveKV);
        //Now Doing Cable Sizes.
        RadioButton EightAWG = (RadioButton)findViewById(R.id.eightAWG);
        RadioButton SevenAWG =(RadioButton)findViewById(R.id.sevenAWG);
        RadioButton SixAWG = (RadioButton)findViewById(R.id.sixAWG);
        RadioButton FiveAWG = (RadioButton)findViewById(R.id.fiveAWG);
        RadioButton FourAWG = (RadioButton)findViewById(R.id.fourAWG);
        RadioButton ThreeAWG = (RadioButton)findViewById(R.id.ThreeAWG);
        RadioButton TwoAWG = (RadioButton)findViewById(R.id.twoAWG);
        RadioButton OneAWG = (RadioButton)findViewById(R.id.oneAWG);
        RadioButton OneAltAWG = (RadioButton)findViewById(R.id.oneAltAWG);
        RadioButton TwoAltAWG = (RadioButton)findViewById(R.id.twoAltAWG);
        RadioButton ThreeAltAWG = (RadioButton)findViewById(R.id.threeAltAWG);
        RadioButton FourAltAWG = (RadioButton)findViewById(R.id.fourAltAWG);
        RadioButton TwoFiftyMCM =(RadioButton)findViewById(R.id.twofiftyMCM);
        RadioButton FiveHundredMCM =(RadioButton)findViewById(R.id.fivehundredMCM);




        if(Portable.isChecked())
            CableType=0;
        else if (Feeder.isChecked())
            CableType=1;
        if (Shielded.isChecked())
            shielded=1;
        else if (Unshielded.isChecked())
            shielded=0;
        if (TwoKV.isChecked())
            Insulation=2;
        else if (FiveKV.isChecked())
            Insulation=5;
        else if (EightKV.isChecked())
            Insulation=8;
        else if (FifteenKV.isChecked())
            Insulation=15;
        else if (TwentyfiveKV.isChecked())
            Insulation=25;
        if (EightAWG.isChecked())
            Wiresize=8;
        else if (SevenAWG.isChecked())
            Wiresize=7;
        else if (SixAWG.isChecked())
            Wiresize=6;
        else if (FiveAWG.isChecked())
            Wiresize=5;
        else if (FourAWG.isChecked())
            Wiresize=4;
        else if (ThreeAWG.isChecked())
            Wiresize=3;
        else if (TwoAWG.isChecked())
            Wiresize=2;
        else if (OneAWG.isChecked())
            Wiresize=1;
        else if (OneAltAWG.isChecked())
            Wiresize=10;
        else if (TwoAltAWG.isChecked())
            Wiresize=20;
        else if (ThreeAltAWG.isChecked())
            Wiresize=30;
        else if (FourAltAWG.isChecked())
            Wiresize=40;
        else if (TwoFiftyMCM.isChecked())
            Wiresize=250;
        else if (FiveHundredMCM.isChecked())
            Wiresize=500;



        //Declaring our Variables for use, that could not be declaring earlier, or was inconvient.
        double distance=format((EditText)findViewById(R.id.CableLength));
        Complex test =CableValues.impedance(Wiresize, shielded, CableType, Insulation, distance);
        double Rmax=CableValues.max_resistance(test.re());
        double ZMaximum=Math.sqrt(Rmax*Rmax+test.im()*test.im());
        int Ampacity=CableValues.Ampacity(Wiresize,shielded,Insulation,CableType);
        int Ampacity50=CableValues.AmpacityCorrection50(Ampacity);
        double ShortCircuitValue=CableValues.ShortCircuitInsulation(Wiresize);


        //Declaring Which local Variables are linked to which ID's.
        TextView Resistance = (TextView)findViewById(R.id.ResistanceBox);
        TextView Reactance = (TextView)findViewById(R.id.ReactanceBox);
        TextView Zmin = (TextView)findViewById(R.id.ImpedanceMinBox);
        TextView Zmax = (TextView)findViewById(R.id.ImpedanceMaxBox);
        TextView ResistanceMax = (TextView)findViewById(R.id.ResistanceBox90);
        TextView AmpacityText= (TextView)findViewById(R.id.AmpacityBox40);
        TextView AmpacityText50 = (TextView)findViewById(R.id.AmpacityBox50);
        TextView ShortCircuit = (TextView)findViewById(R.id.ShortCircuitInsulationBox);

        //Setting our Results Text Box's Below.
        Zmin.setText(String.format("%.4f",test.abs()));
        Resistance.setText(String.format("%.4f",test.re()));
        Reactance.setText(String.format("%.4f", test.im()));
        Zmax.setText(String.format("%.4f",ZMaximum));
        ResistanceMax.setText(String.format("%.4f",Rmax));
        AmpacityText.setText(String.valueOf(Ampacity));//No Need for format option here as it's already a int.
        AmpacityText50.setText(String.valueOf(Ampacity50));
        ShortCircuit.setText(String.format("%.1f",ShortCircuitValue));








    }

}

